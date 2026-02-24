use crate::platform::{normalize_or_generate_trace_id, AppError, AppResult};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct IpcHealthResponse {
    pub status: String,
    pub timestamp: String,
    pub trace_id: String,
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_health_check(trace_id: Option<String>) -> AppResult<IpcHealthResponse> {
    let trace_id = normalize_or_generate_trace_id(trace_id);

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| {
            AppError::internal(
                format!("Failed to get current timestamp: {}", error),
                trace_id.clone(),
                "health.ipc_health_check",
            )
        })?
        .as_millis()
        .to_string();

    Ok(IpcHealthResponse {
        status: "ok".to_string(),
        timestamp,
        trace_id,
    })
}
