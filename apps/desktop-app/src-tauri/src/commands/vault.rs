use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct VaultConfig {
    pub path: String,
    pub name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn open_vault(path: String) -> Result<VaultConfig, String> {
    let vault_path = Path::new(&path);

    if !vault_path.exists() {
        return Err(format!("Vault path does not exist: {}", path));
    }

    if !vault_path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", path));
    }

    let name = vault_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Vault")
        .to_string();

    Ok(VaultConfig {
        path: path.clone(),
        name,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn create_vault(path: String, name: String) -> Result<VaultConfig, String> {
    let vault_path = Path::new(&path);

    if vault_path.exists() {
        return Err(format!("Path already exists: {}", path));
    }

    std::fs::create_dir_all(&vault_path).map_err(|e| format!("Failed to create vault: {}", e))?;

    Ok(VaultConfig { path, name })
}
