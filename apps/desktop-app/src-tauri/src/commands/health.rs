use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, specta::Type)]
pub struct IpcHealthResponse {
    pub status: String,
    pub timestamp: String,
}

#[tauri::command]
#[specta::specta]
pub async fn ipc_health_check() -> Result<IpcHealthResponse, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to get current timestamp: {}", error))?
        .as_millis()
        .to_string();

    Ok(IpcHealthResponse {
        status: "ok".to_string(),
        timestamp,
    })
}
