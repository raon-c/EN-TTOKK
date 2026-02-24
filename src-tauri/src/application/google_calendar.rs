use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use url::{form_urlencoded, Url};

const GOOGLE_CALLBACK_PORT: u16 = 31337;
const GOOGLE_TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const OAUTH_RESULT_TTL_MS: u128 = 5 * 60 * 1000;

static OAUTH_RESULTS: OnceLock<Mutex<HashMap<String, OAuthResult>>> = OnceLock::new();
static CALLBACK_SERVER_STARTED: AtomicBool = AtomicBool::new(false);
static GOOGLE_ENV_LOADED: OnceLock<()> = OnceLock::new();

#[derive(Debug, Clone)]
struct OAuthResult {
    code: Option<String>,
    error: Option<String>,
    received_at_ms: u128,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthResult {
    pub status: String,
    pub code: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyResponse {
    pub status: u16,
    pub data_json: String,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GoogleTokenExchangeInput {
    pub grant_type: String,
    pub code: Option<String>,
    pub code_verifier: Option<String>,
    pub refresh_token: Option<String>,
    pub redirect_uri: String,
    pub client_id: String,
    pub client_secret: Option<String>,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct GoogleEventsInput {
    pub access_token: String,
    pub calendar_id: Option<String>,
    pub time_min: Option<String>,
    pub time_max: Option<String>,
    pub sync_token: Option<String>,
    pub page_token: Option<String>,
    pub max_results: Option<u32>,
}

fn oauth_results() -> &'static Mutex<HashMap<String, OAuthResult>> {
    OAUTH_RESULTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> Result<u128, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to read current time: {}", error))?
        .as_millis())
}

fn prune_oauth_results() -> Result<(), String> {
    let current = now_ms()?;
    let mut results = oauth_results()
        .lock()
        .map_err(|error| format!("Failed to lock OAuth results: {}", error))?;
    results
        .retain(|_, result| current.saturating_sub(result.received_at_ms) <= OAUTH_RESULT_TTL_MS);
    Ok(())
}

fn write_http_response(
    stream: &mut TcpStream,
    status_line: &str,
    content_type: &str,
    body: &str,
) -> Result<(), String> {
    let response = format!(
        "{status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    stream
        .write_all(response.as_bytes())
        .map_err(|error| format!("Failed to write callback response: {}", error))
}

fn extract_query_value(url: &Url, key: &str) -> Option<String> {
    url.query_pairs()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value.into_owned())
}

fn handle_callback_connection(mut stream: TcpStream) -> Result<(), String> {
    let mut buffer = [0_u8; 8192];
    let read = stream
        .read(&mut buffer)
        .map_err(|error| format!("Failed to read callback request: {}", error))?;
    if read == 0 {
        return Ok(());
    }

    let request = String::from_utf8_lossy(&buffer[..read]);
    let Some(request_line) = request.lines().next() else {
        return Ok(());
    };

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path_with_query = parts.next().unwrap_or("/");

    if method != "GET" {
        let _ = write_http_response(
            &mut stream,
            "HTTP/1.1 405 Method Not Allowed",
            "text/plain; charset=utf-8",
            "Method Not Allowed",
        );
        return Ok(());
    }

    let callback_url = Url::parse(&format!("http://127.0.0.1{}", path_with_query))
        .map_err(|error| format!("Invalid callback URL: {}", error))?;

    if callback_url.path() != "/oauth/google/callback" {
        let _ = write_http_response(
            &mut stream,
            "HTTP/1.1 404 Not Found",
            "text/plain; charset=utf-8",
            "Not Found",
        );
        return Ok(());
    }

    let Some(state) = extract_query_value(&callback_url, "state") else {
        let _ = write_http_response(
            &mut stream,
            "HTTP/1.1 400 Bad Request",
            "text/plain; charset=utf-8",
            "Missing state",
        );
        return Ok(());
    };

    prune_oauth_results()?;
    let code = extract_query_value(&callback_url, "code");
    let error = extract_query_value(&callback_url, "error");
    let received_at_ms = now_ms()?;

    oauth_results()
        .lock()
        .map_err(|lock_error| format!("Failed to lock OAuth results: {}", lock_error))?
        .insert(
            state,
            OAuthResult {
                code,
                error,
                received_at_ms,
            },
        );

    let body = r#"
      <html>
        <head><title>Google Calendar Connected</title></head>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Connection received</h2>
          <p>You can return to the app. This window can be closed.</p>
        </body>
      </html>
    "#;

    let _ = write_http_response(
        &mut stream,
        "HTTP/1.1 200 OK",
        "text/html; charset=utf-8",
        body.trim(),
    );
    Ok(())
}

fn start_callback_server() -> Result<(), String> {
    if CALLBACK_SERVER_STARTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    let listener = TcpListener::bind(("127.0.0.1", GOOGLE_CALLBACK_PORT)).map_err(|error| {
        CALLBACK_SERVER_STARTED.store(false, Ordering::SeqCst);
        format!("Failed to start Google OAuth callback server: {}", error)
    })?;

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    if let Err(error) = handle_callback_connection(stream) {
                        eprintln!("Google OAuth callback handling failed: {}", error);
                    }
                }
                Err(error) => {
                    eprintln!("Google OAuth callback server connection failed: {}", error);
                }
            }
        }
        CALLBACK_SERVER_STARTED.store(false, Ordering::SeqCst);
    });

    Ok(())
}

fn encode_path_segment(value: &str) -> String {
    form_urlencoded::byte_serialize(value.as_bytes()).collect::<String>()
}

fn validate_token_exchange_input(input: &GoogleTokenExchangeInput) -> Result<(), String> {
    if input.client_id.trim().is_empty() {
        return Err("Client ID is required".to_string());
    }
    if input.redirect_uri.trim().is_empty() {
        return Err("Redirect URI is required".to_string());
    }

    match input.grant_type.as_str() {
        "authorization_code" => {
            if input.code.as_deref().unwrap_or_default().trim().is_empty() {
                return Err("Authorization code is required".to_string());
            }
            if input
                .code_verifier
                .as_deref()
                .unwrap_or_default()
                .trim()
                .is_empty()
            {
                return Err("Code verifier is required".to_string());
            }
        }
        "refresh_token" => {
            if input
                .refresh_token
                .as_deref()
                .unwrap_or_default()
                .trim()
                .is_empty()
            {
                return Err("Refresh token is required".to_string());
            }
        }
        _ => return Err("Unsupported grant type".to_string()),
    }

    Ok(())
}

fn create_http_client(timeout_secs: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))
}

fn load_google_env_once() {
    GOOGLE_ENV_LOADED.get_or_init(|| {
        let _ = dotenvy::from_filename(".env");
        if let Some(app_dir) = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
            let _ = dotenvy::from_path(app_dir.join(".env"));
        }
    });
}

fn resolve_google_client_secret(explicit_secret: Option<&str>) -> Option<String> {
    if let Some(secret) = explicit_secret
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(secret.to_string());
    }

    load_google_env_once();
    std::env::var("GOOGLE_CLIENT_SECRET")
        .ok()
        .map(|secret| secret.trim().to_string())
        .filter(|secret| !secret.is_empty())
}

pub fn google_prepare_oauth() -> Result<(), String> {
    start_callback_server()?;
    prune_oauth_results()?;
    Ok(())
}

pub fn google_poll_oauth_result(state: String) -> Result<GoogleAuthResult, String> {
    if state.trim().is_empty() {
        return Err("Missing state".to_string());
    }

    prune_oauth_results()?;
    let mut results = oauth_results()
        .lock()
        .map_err(|error| format!("Failed to lock OAuth results: {}", error))?;

    let Some(result) = results.get(&state).cloned() else {
        return Ok(GoogleAuthResult {
            status: "pending".to_string(),
            code: None,
            error: None,
        });
    };

    if let Some(error) = result.error {
        results.remove(&state);
        return Ok(GoogleAuthResult {
            status: "error".to_string(),
            code: None,
            error: Some(error),
        });
    }

    if let Some(code) = result.code {
        results.remove(&state);
        return Ok(GoogleAuthResult {
            status: "complete".to_string(),
            code: Some(code),
            error: None,
        });
    }

    Ok(GoogleAuthResult {
        status: "pending".to_string(),
        code: None,
        error: None,
    })
}

pub fn google_exchange_token(
    params: GoogleTokenExchangeInput,
) -> Result<HttpProxyResponse, String> {
    validate_token_exchange_input(&params)?;

    let client = create_http_client(15)?;
    let mut form = HashMap::new();
    form.insert("client_id", params.client_id);
    form.insert("redirect_uri", params.redirect_uri);

    let resolved_secret = resolve_google_client_secret(params.client_secret.as_deref());
    if let Some(secret) = resolved_secret {
        form.insert("client_secret", secret);
    }

    match params.grant_type.as_str() {
        "authorization_code" => {
            form.insert("grant_type", "authorization_code".to_string());
            form.insert("code", params.code.unwrap_or_default());
            form.insert("code_verifier", params.code_verifier.unwrap_or_default());
        }
        "refresh_token" => {
            form.insert("grant_type", "refresh_token".to_string());
            form.insert("refresh_token", params.refresh_token.unwrap_or_default());
        }
        _ => return Err("Unsupported grant type".to_string()),
    }

    let response = client
        .post(GOOGLE_TOKEN_ENDPOINT)
        .form(&form)
        .send()
        .map_err(|error| format!("Failed to call Google OAuth token API: {}", error))?;

    let status = response.status().as_u16();
    let data_json = response
        .text()
        .unwrap_or_else(|_| "{}".to_string())
        .trim()
        .to_string();

    Ok(HttpProxyResponse {
        status,
        data_json: if data_json.is_empty() {
            "{}".to_string()
        } else {
            data_json
        },
    })
}

pub fn google_list_events(params: GoogleEventsInput) -> Result<HttpProxyResponse, String> {
    if params.access_token.trim().is_empty() {
        return Err("Access token is required".to_string());
    }

    if params.sync_token.is_none()
        && (params
            .time_min
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
            || params
                .time_max
                .as_deref()
                .unwrap_or_default()
                .trim()
                .is_empty())
    {
        return Err("timeMin and timeMax are required without syncToken".to_string());
    }

    let client = create_http_client(15)?;
    let calendar_id = params.calendar_id.unwrap_or_else(|| "primary".to_string());
    let encoded_calendar_id = encode_path_segment(calendar_id.trim());
    let base_url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/{}/events",
        encoded_calendar_id
    );
    let mut url = Url::parse(&base_url)
        .map_err(|error| format!("Failed to build Google Calendar URL: {}", error))?;

    {
        let mut query = url.query_pairs_mut();
        if let Some(sync_token) = params.sync_token.as_deref() {
            query.append_pair("syncToken", sync_token);
            query.append_pair("showDeleted", "true");
        } else {
            query.append_pair("timeMin", params.time_min.as_deref().unwrap_or_default());
            query.append_pair("timeMax", params.time_max.as_deref().unwrap_or_default());
            query.append_pair("singleEvents", "true");
            query.append_pair("orderBy", "startTime");
            query.append_pair("showDeleted", "true");
        }
        if let Some(page_token) = params.page_token.as_deref() {
            query.append_pair("pageToken", page_token);
        }
        if let Some(max_results) = params.max_results {
            query.append_pair("maxResults", &max_results.to_string());
        }
    }

    let response = client
        .get(url)
        .bearer_auth(params.access_token.trim())
        .send()
        .map_err(|error| format!("Failed to call Google Calendar API: {}", error))?;

    let status = response.status().as_u16();
    let data_json = response
        .text()
        .unwrap_or_else(|_| "{}".to_string())
        .trim()
        .to_string();

    Ok(HttpProxyResponse {
        status,
        data_json: if data_json.is_empty() {
            "{}".to_string()
        } else {
            data_json
        },
    })
}
