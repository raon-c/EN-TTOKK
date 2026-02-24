use crate::application::jira as jira_app;
use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};

pub use crate::application::jira::{
    JiraIssuesListResponse, JiraRequestInput, JiraTestConnectionResponse,
};

fn classify_jira_error(message: &str) -> (&'static str, bool) {
    let lowered = message.to_lowercase();

    if lowered.contains("invalid email address")
        || lowered.contains("api token is required")
        || lowered.contains("invalid jira base url")
        || lowered.contains("jira base url must")
    {
        return ("validation_error", false);
    }

    if lowered.contains("timed out") {
        return ("jira_timeout", true);
    }

    if lowered.contains("too many requests")
        || lowered.contains("rate limit")
        || lowered.contains("status: 429")
    {
        return ("jira_rate_limited", true);
    }

    if lowered.contains("unable to reach jira api") {
        return ("jira_unreachable", true);
    }

    if lowered.contains("failed to create jira client") {
        return ("jira_client_init_failed", false);
    }

    ("jira_request_failed", false)
}

fn map_jira_error(message: impl Into<String>, trace_id: &str, source: &str) -> AppError {
    let message = message.into();
    let (code, retryable) = classify_jira_error(&message);

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
pub async fn jira_test_connection(
    params: JiraRequestInput,
    trace_id: Option<String>,
) -> AppResult<JiraTestConnectionResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    tauri::async_runtime::spawn_blocking(move || jira_app::jira_test_connection(params))
        .await
        .map_err(|error| {
            map_jira_error(
                format!("Jira connection test task failed: {}", error),
                &trace_id,
                "jira.jira_test_connection.spawn_blocking",
            )
        })?
        .map_err(|error| map_jira_error(error, &trace_id, "jira.jira_test_connection.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn jira_list_issues(
    params: JiraRequestInput,
    trace_id: Option<String>,
) -> AppResult<JiraIssuesListResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    tauri::async_runtime::spawn_blocking(move || jira_app::jira_list_issues(params))
        .await
        .map_err(|error| {
            map_jira_error(
                format!("Jira issues fetch task failed: {}", error),
                &trace_id,
                "jira.jira_list_issues.spawn_blocking",
            )
        })?
        .map_err(|error| map_jira_error(error, &trace_id, "jira.jira_list_issues.execute"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_jira_timeout_is_retryable() {
        assert_eq!(
            classify_jira_error("Jira request timed out"),
            ("jira_timeout", true)
        );
    }

    #[test]
    fn classify_jira_rate_limit_is_retryable() {
        assert_eq!(
            classify_jira_error("Too many requests (status: 429)"),
            ("jira_rate_limited", true)
        );
    }

    #[test]
    fn classify_jira_validation_is_not_retryable() {
        assert_eq!(
            classify_jira_error("API token is required"),
            ("validation_error", false)
        );
    }
}
