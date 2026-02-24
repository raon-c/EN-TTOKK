use base64::{engine::general_purpose, Engine as _};
use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use url::Url;

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct JiraRequestInput {
    pub base_url: String,
    pub email: String,
    pub api_token: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct JiraUserProfile {
    pub display_name: String,
    pub email_address: Option<String>,
    pub account_id: Option<String>,
    pub avatar_urls: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct JiraTestConnectionResponse {
    pub profile: JiraUserProfile,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct JiraIssue {
    pub key: String,
    pub summary: String,
    pub status: String,
    pub updated: Option<String>,
    pub assignee: Option<String>,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct JiraIssuesListResponse {
    pub issues: Vec<JiraIssue>,
}

fn validate_email(email: &str) -> Result<(), String> {
    let trimmed = email.trim();
    if trimmed.is_empty() || !trimmed.contains('@') {
        return Err("Invalid email address".to_string());
    }
    Ok(())
}

fn validate_api_token(token: &str) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("API token is required".to_string());
    }
    Ok(())
}

fn normalize_base_url(base_url: &str) -> Result<String, String> {
    let parsed = Url::parse(base_url.trim()).map_err(|_| "Invalid Jira base URL".to_string())?;

    if parsed.scheme() != "https" {
        return Err("Jira base URL must start with https://".to_string());
    }

    let hostname = parsed
        .host_str()
        .ok_or_else(|| "Invalid Jira base URL".to_string())?;

    if !hostname.ends_with(".atlassian.net") {
        return Err(
            "Jira base URL must be a Jira Cloud site (e.g. https://your-domain.atlassian.net)"
                .to_string(),
        );
    }

    let path_ok = parsed.path().is_empty() || parsed.path() == "/";
    if !path_ok
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.port().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(
            "Jira base URL must be a Jira Cloud site (e.g. https://your-domain.atlassian.net)"
                .to_string(),
        );
    }

    Ok(format!("{}://{}", parsed.scheme(), hostname))
}

fn build_basic_auth(email: &str, api_token: &str) -> String {
    general_purpose::STANDARD.encode(format!("{}:{}", email.trim(), api_token.trim()))
}

fn extract_jira_error(data: &Value, status: u16) -> String {
    if let Some(error_messages) = data.get("errorMessages").and_then(Value::as_array) {
        if let Some(first) = error_messages.first().and_then(Value::as_str) {
            if !first.trim().is_empty() {
                return first.to_string();
            }
        }
    }

    if let Some(message) = data.get("message").and_then(Value::as_str) {
        if !message.trim().is_empty() {
            return message.to_string();
        }
    }

    if let Some(errors) = data.get("errors").and_then(Value::as_object) {
        if let Some(first) = errors.values().find_map(Value::as_str) {
            if !first.trim().is_empty() {
                return first.to_string();
            }
        }
    }

    format!("Jira request failed: {}", status)
}

fn create_jira_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(Policy::none())
        .build()
        .map_err(|error| format!("Failed to create Jira client: {}", error))
}

fn request_jira(
    client: &Client,
    method: Method,
    url: &str,
    auth: &str,
    body: Option<Value>,
) -> Result<(u16, Value), String> {
    let mut request = client
        .request(method, url)
        .header("Accept", "application/json")
        .header("Authorization", format!("Basic {}", auth));

    if let Some(body) = body {
        request = request
            .header("Content-Type", "application/json")
            .json(&body);
    }

    let response = request.send().map_err(|error| {
        if error.is_timeout() {
            "Jira request timed out".to_string()
        } else {
            "Unable to reach Jira API".to_string()
        }
    })?;

    let status = response.status().as_u16();
    let data = response.json::<Value>().unwrap_or_else(|_| json!({}));
    Ok((status, data))
}

pub fn jira_test_connection(
    params: JiraRequestInput,
) -> Result<JiraTestConnectionResponse, String> {
    validate_email(&params.email)?;
    validate_api_token(&params.api_token)?;
    let normalized_base_url = normalize_base_url(&params.base_url)?;

    let client = create_jira_client()?;
    let auth = build_basic_auth(&params.email, &params.api_token);
    let url = format!("{}/rest/api/3/myself", normalized_base_url);
    let (status, data) = request_jira(&client, Method::GET, &url, &auth, None)?;

    if status >= 400 {
        return Err(extract_jira_error(&data, status));
    }

    let avatar_urls = data
        .get("avatarUrls")
        .and_then(Value::as_object)
        .map(|avatar_map| {
            avatar_map
                .iter()
                .filter_map(|(key, value)| value.as_str().map(|url| (key.clone(), url.to_string())))
                .collect::<std::collections::HashMap<_, _>>()
        });

    Ok(JiraTestConnectionResponse {
        profile: JiraUserProfile {
            display_name: data
                .get("displayName")
                .and_then(Value::as_str)
                .unwrap_or("Unknown")
                .to_string(),
            email_address: data
                .get("emailAddress")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned),
            account_id: data
                .get("accountId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned),
            avatar_urls,
        },
    })
}

pub fn jira_list_issues(params: JiraRequestInput) -> Result<JiraIssuesListResponse, String> {
    validate_email(&params.email)?;
    validate_api_token(&params.api_token)?;
    let normalized_base_url = normalize_base_url(&params.base_url)?;

    let client = create_jira_client()?;
    let auth = build_basic_auth(&params.email, &params.api_token);
    let url = format!("{}/rest/api/3/search/jql", normalized_base_url);
    let body = json!({
        "jql": "assignee = currentUser() ORDER BY updated DESC",
        "maxResults": 20,
        "fields": ["key", "summary", "status", "assignee", "updated"]
    });

    let (status, data) = request_jira(&client, Method::POST, &url, &auth, Some(body))?;

    if status >= 400 {
        return Err(extract_jira_error(&data, status));
    }

    let issues = data
        .get("issues")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let key = item.get("key")?.as_str()?.to_string();
                    if key.trim().is_empty() {
                        return None;
                    }

                    let fields = item.get("fields").unwrap_or(&Value::Null);
                    let summary = fields
                        .get("summary")
                        .and_then(Value::as_str)
                        .unwrap_or("Untitled issue")
                        .to_string();
                    let status = fields
                        .get("status")
                        .and_then(|status| status.get("name"))
                        .and_then(Value::as_str)
                        .unwrap_or("Unknown")
                        .to_string();
                    let updated = fields
                        .get("updated")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned);
                    let assignee = fields
                        .get("assignee")
                        .and_then(|assignee| assignee.get("displayName"))
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned);

                    Some(JiraIssue {
                        key,
                        summary,
                        status,
                        updated,
                        assignee,
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(JiraIssuesListResponse { issues })
}
