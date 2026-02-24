use crate::application::google_calendar as google_calendar_app;
use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};

pub use crate::application::google_calendar::{
    GoogleAuthResult, GoogleEventsInput, GoogleTokenExchangeInput, HttpProxyResponse,
};

fn classify_google_error(message: &str) -> (&'static str, bool) {
    let lowered = message.to_lowercase();

    if lowered.contains("client id is required")
        || lowered.contains("redirect uri is required")
        || lowered.contains("authorization code is required")
        || lowered.contains("code verifier is required")
        || lowered.contains("refresh token is required")
        || lowered.contains("unsupported grant type")
        || lowered.contains("missing state")
        || lowered.contains("timemin and timemax are required")
        || lowered.contains("access token is required")
    {
        return ("validation_error", false);
    }

    if lowered.contains("timed out") {
        return ("google_timeout", true);
    }

    if lowered.contains("rate limit")
        || lowered.contains("too many requests")
        || lowered.contains("status: 429")
    {
        return ("google_rate_limited", true);
    }

    if lowered.contains("failed to lock oauth results")
        || lowered.contains("failed to start google oauth callback server")
    {
        return ("google_oauth_state_error", false);
    }

    if lowered.contains("failed to call google oauth token api")
        || lowered.contains("failed to call google calendar api")
        || lowered.contains("google token exchange task failed")
        || lowered.contains("google events request task failed")
    {
        return ("google_request_failed", true);
    }

    if lowered.contains("failed to create http client") {
        return ("google_http_client_error", false);
    }

    ("google_command_failed", false)
}

fn map_google_error(message: impl Into<String>, trace_id: &str, source: &str) -> AppError {
    let message = message.into();
    let (code, retryable) = classify_google_error(&message);

    AppError::new(
        code,
        message,
        retryable,
        trace_id.to_string(),
        source.to_string(),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn google_prepare_oauth(_state: String, trace_id: Option<String>) -> AppResult<()> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    google_calendar_app::google_prepare_oauth()
        .map_err(|error| map_google_error(error, &trace_id, "google.google_prepare_oauth.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn google_poll_oauth_result(
    state: String,
    trace_id: Option<String>,
) -> AppResult<GoogleAuthResult> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    google_calendar_app::google_poll_oauth_result(state).map_err(|error| {
        map_google_error(error, &trace_id, "google.google_poll_oauth_result.execute")
    })
}

#[tauri::command]
#[specta::specta]
pub async fn google_exchange_token(
    params: GoogleTokenExchangeInput,
    trace_id: Option<String>,
) -> AppResult<HttpProxyResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    tauri::async_runtime::spawn_blocking(move || google_calendar_app::google_exchange_token(params))
        .await
        .map_err(|error| {
            map_google_error(
                format!("Google token exchange task failed: {}", error),
                &trace_id,
                "google.google_exchange_token.spawn_blocking",
            )
        })?
        .map_err(|error| map_google_error(error, &trace_id, "google.google_exchange_token.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn google_list_events(
    params: GoogleEventsInput,
    trace_id: Option<String>,
) -> AppResult<HttpProxyResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    tauri::async_runtime::spawn_blocking(move || google_calendar_app::google_list_events(params))
        .await
        .map_err(|error| {
            map_google_error(
                format!("Google events request task failed: {}", error),
                &trace_id,
                "google.google_list_events.spawn_blocking",
            )
        })?
        .map_err(|error| map_google_error(error, &trace_id, "google.google_list_events.execute"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_google_timeout_is_retryable() {
        assert_eq!(
            classify_google_error("Google request timed out"),
            ("google_timeout", true)
        );
    }

    #[test]
    fn classify_google_rate_limit_is_retryable() {
        assert_eq!(
            classify_google_error("Too many requests (status: 429)"),
            ("google_rate_limited", true)
        );
    }

    #[test]
    fn classify_google_validation_is_not_retryable() {
        assert_eq!(
            classify_google_error("Access token is required"),
            ("validation_error", false)
        );
    }
}
