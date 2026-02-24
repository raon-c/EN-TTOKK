use crate::application::claude_activity as claude_activity_app;
use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};

pub use crate::application::claude_activity::ClaudeActivityResponse;

fn classify_claude_error(message: &str) -> (&'static str, bool) {
    let lowered = message.to_lowercase();

    if lowered.contains("date must")
        || lowered.contains("invalid year")
        || lowered.contains("invalid month")
        || lowered.contains("invalid day")
        || lowered.contains("month must")
    {
        return ("invalid_input", false);
    }

    if lowered.contains("cannot find home directory") {
        return ("claude_home_not_found", false);
    }

    if lowered.contains("timed out") || lowered.contains("timeout") {
        return ("claude_timeout", true);
    }

    if lowered.contains("failed to read")
        || lowered.contains("permission denied")
        || lowered.contains("no such file")
    {
        return ("claude_filesystem_error", true);
    }

    ("claude_activity_failed", false)
}

fn map_claude_error(message: impl Into<String>, trace_id: &str, source: &str) -> AppError {
    let message = message.into();
    let (code, retryable) = classify_claude_error(&message);
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
pub async fn list_claude_projects(trace_id: Option<String>) -> AppResult<Vec<String>> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    claude_activity_app::list_claude_projects()
        .map_err(|error| map_claude_error(error, &trace_id, "claude.list_claude_projects.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn get_claude_activities(
    date: String,
    subscribed_folders: Vec<String>,
    trace_id: Option<String>,
) -> AppResult<ClaudeActivityResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    claude_activity_app::get_claude_activities(date, subscribed_folders)
        .map_err(|error| map_claude_error(error, &trace_id, "claude.get_claude_activities.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn get_claude_activity_dates(
    subscribed_folders: Vec<String>,
    year: i32,
    month: u32,
    trace_id: Option<String>,
) -> AppResult<Vec<u32>> {
    let trace_id = normalize_or_generate_trace_id(trace_id);
    claude_activity_app::get_claude_activity_dates(subscribed_folders, year, month).map_err(
        |error| map_claude_error(error, &trace_id, "claude.get_claude_activity_dates.execute"),
    )
}
