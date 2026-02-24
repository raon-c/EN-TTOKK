use crate::application::chat_stream as chat_stream_app;
use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};
use tauri::AppHandle;

pub use crate::application::chat_stream::{ChatStatusResponse, ChatStreamStartInput};

fn classify_chat_error(message: &str) -> (&'static str, bool) {
    let lowered = message.to_lowercase();

    if lowered.contains("message is required")
        || lowered.contains("message too long")
        || lowered.contains("requestid is required")
        || lowered.contains("path cannot contain")
    {
        return ("validation_error", false);
    }

    if lowered.contains("failed to spawn claude cli") {
        return ("chat_spawn_failed", false);
    }

    if lowered.contains("failed to capture claude stdout")
        || lowered.contains("failed to capture claude stderr")
        || lowered.contains("failed to track active stream")
        || lowered.contains("failed to track cancelled stream")
        || lowered.contains("failed to access active streams")
    {
        return ("chat_stream_state_failed", false);
    }

    ("chat_stream_failed", false)
}

fn map_chat_error(message: impl Into<String>, trace_id: &str, source: &str) -> AppError {
    let message = message.into();
    let (code, retryable) = classify_chat_error(&message);

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
pub async fn chat_check_status() -> Result<ChatStatusResponse, String> {
    chat_stream_app::chat_check_status()
}

#[tauri::command]
#[specta::specta]
pub async fn chat_start_stream(
    app: AppHandle,
    input: ChatStreamStartInput,
    trace_id: Option<String>,
) -> AppResult<()> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    chat_stream_app::chat_start_stream(app, input)
        .map_err(|error| map_chat_error(error, &trace_id, "chat.chat_start_stream.execute"))
}

#[tauri::command]
#[specta::specta]
pub async fn chat_cancel_stream(request_id: String, trace_id: Option<String>) -> AppResult<bool> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    chat_stream_app::chat_cancel_stream(request_id)
        .map_err(|error| map_chat_error(error, &trace_id, "chat.chat_cancel_stream.execute"))
}
