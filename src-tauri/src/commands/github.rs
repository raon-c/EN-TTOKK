use crate::application::github_activity as github_activity_app;
use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};

pub use crate::application::github_activity::GitHubActivityResponse;

#[tauri::command]
#[specta::specta]
pub async fn get_github_activity(
    date: String,
    trace_id: Option<String>,
) -> AppResult<GitHubActivityResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    let response = tauri::async_runtime::spawn_blocking(move || {
        github_activity_app::get_github_activity(date)
    })
    .await
    .map_err(|error| {
        map_github_error(
            format!("GitHub activity task failed: {}", error),
            &trace_id,
            "github.get_github_activity.spawn_blocking",
        )
    })?
    .map_err(|error| map_github_error(error, &trace_id, "github.get_github_activity.execute"))?;

    Ok(response)
}

fn classify_github_error(message: &str) -> (&'static str, bool) {
    let lowered = message.to_lowercase();

    if lowered.contains("date must be in") || lowered.contains("unexpected github login format") {
        return ("validation_error", false);
    }

    if lowered.contains("gh) not found") || lowered.contains("github cli (gh) not found") {
        return ("github_cli_not_found", false);
    }

    if lowered.contains("auth login")
        || lowered.contains("not logged into any hosts")
        || lowered.contains("not authenticated")
    {
        return ("github_auth_required", false);
    }

    if lowered.contains("secondary rate")
        || lowered.contains("rate limit")
        || lowered.contains("retry-after")
        || lowered.contains("too many requests")
    {
        return ("github_rate_limited", true);
    }

    if lowered.contains("request failed") || lowered.contains("failed to run gh") {
        return ("github_request_failed", true);
    }

    if lowered.contains("invalid") {
        return ("github_response_invalid", false);
    }

    ("github_activity_failed", false)
}

fn map_github_error(message: impl Into<String>, trace_id: &str, source: &str) -> AppError {
    let message = message.into();
    let (code, retryable) = classify_github_error(&message);

    AppError::new(
        code,
        message,
        retryable,
        trace_id.to_string(),
        source.to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_github_rate_limit_is_retryable() {
        assert_eq!(
            classify_github_error("secondary rate limit exceeded, retry-after: 30"),
            ("github_rate_limited", true)
        );
    }

    #[test]
    fn classify_github_request_failure_is_retryable() {
        assert_eq!(
            classify_github_error("Failed to run gh command"),
            ("github_request_failed", true)
        );
    }

    #[test]
    fn classify_github_validation_error_is_not_retryable() {
        assert_eq!(
            classify_github_error("Date must be in YYYY-MM-DD format"),
            ("validation_error", false)
        );
    }
}
