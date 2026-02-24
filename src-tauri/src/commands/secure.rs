use crate::application::secure as secure_app;
use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};

fn classify_secure_error(message: &str) -> (&'static str, bool) {
    let lowered = message.to_lowercase();

    if lowered.contains("required") || lowered.contains("too long") {
        return ("invalid_input", false);
    }

    if lowered.contains("temporarily unavailable")
        || lowered.contains("timeout")
        || lowered.contains("try again")
    {
        return ("secure_store_unavailable", true);
    }

    if lowered.contains("access denied")
        || lowered.contains("permission denied")
        || lowered.contains("locked")
    {
        return ("secure_store_unavailable", false);
    }

    ("secure_store_failed", false)
}

fn map_secure_error(message: impl Into<String>, trace_id: &str, source: &str) -> AppError {
    let message = message.into();
    let (code, retryable) = classify_secure_error(&message);
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
pub async fn get_jira_token(trace_id: Option<String>) -> AppResult<Option<String>> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    secure_app::get_jira_token()
        .map_err(|error| map_secure_error(error, &trace_id, "secure.get_jira_token.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn set_jira_token(token: String, trace_id: Option<String>) -> AppResult<()> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    secure_app::set_jira_token(&token)
        .map_err(|error| map_secure_error(error, &trace_id, "secure.set_jira_token.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn remove_jira_token(trace_id: Option<String>) -> AppResult<()> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    secure_app::remove_jira_token()
        .map_err(|error| map_secure_error(error, &trace_id, "secure.remove_jira_token.execute"))
}
