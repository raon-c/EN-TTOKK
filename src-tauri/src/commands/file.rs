use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

/// Validates that the given path is within the vault directory.
/// Returns the canonicalized path if valid, or an error if the path is outside the vault.
fn validate_path_within_vault(path: &str, vault_path: &str) -> Result<PathBuf, String> {
    let target_path = Path::new(path);
    let vault = Path::new(vault_path);

    // For new files that don't exist yet, check the parent directory
    let path_to_check = if target_path.exists() {
        target_path
            .canonicalize()
            .map_err(|e| format!("Failed to resolve path: {}", e))?
    } else {
        // For non-existent paths, canonicalize the parent and append the filename
        let parent = target_path
            .parent()
            .ok_or_else(|| "Invalid path: no parent directory".to_string())?;

        if !parent.exists() {
            // If parent doesn't exist, use simple prefix check
            // Note: This is less secure but necessary for deeply nested new paths
            if !path.starts_with(vault_path) {
                return Err("Access denied: path is outside vault directory".to_string());
            }
            return Ok(target_path.to_path_buf());
        }

        let parent_canonical = parent
            .canonicalize()
            .map_err(|e| format!("Failed to resolve parent path: {}", e))?;

        parent_canonical.join(target_path.file_name().unwrap_or_default())
    };

    let vault_canonical = vault
        .canonicalize()
        .map_err(|e| format!("Failed to resolve vault path: {}", e))?;

    if !path_to_check.starts_with(&vault_canonical) {
        return Err("Access denied: path is outside vault directory".to_string());
    }

    Ok(path_to_check)
}

fn build_file_tree(dir_path: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir =
        fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') {
            continue;
        }

        let is_dir = path.is_dir();
        let children = if is_dir {
            Some(build_file_tree(&path)?)
        } else {
            // Only include markdown files
            if path.extension().map_or(false, |ext| ext == "md") {
                None
            } else {
                continue;
            }
        };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    // Sort: directories first, then files alphabetically
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
#[specta::specta]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    build_file_tree(dir_path)
}

#[tauri::command]
#[specta::specta]
pub async fn read_file(path: String, vault_path: String) -> Result<String, String> {
    let validated_path = validate_path_within_vault(&path, &vault_path)?;

    if !validated_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !validated_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    fs::read_to_string(&validated_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
#[specta::specta]
pub async fn write_file(path: String, content: String, vault_path: String) -> Result<(), String> {
    let validated_path = validate_path_within_vault(&path, &vault_path)?;

    // Ensure parent directory exists
    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(&validated_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
#[specta::specta]
pub async fn create_file(path: String, vault_path: String) -> Result<(), String> {
    let validated_path = validate_path_within_vault(&path, &vault_path)?;

    if validated_path.exists() {
        return Err(format!("File already exists: {}", path));
    }

    // Ensure parent directory exists
    if let Some(parent) = validated_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(&validated_path, "").map_err(|e| format!("Failed to create file: {}", e))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_file(path: String, vault_path: String) -> Result<(), String> {
    let validated_path = validate_path_within_vault(&path, &vault_path)?;

    if !validated_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if validated_path.is_dir() {
        fs::remove_dir_all(&validated_path)
            .map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(&validated_path).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
#[specta::specta]
pub async fn rename_file(
    old_path: String,
    new_path: String,
    vault_path: String,
) -> Result<(), String> {
    let validated_old = validate_path_within_vault(&old_path, &vault_path)?;
    let validated_new = validate_path_within_vault(&new_path, &vault_path)?;

    if !validated_old.exists() {
        return Err(format!("File does not exist: {}", old_path));
    }

    if validated_new.exists() {
        return Err(format!("Target path already exists: {}", new_path));
    }

    fs::rename(&validated_old, &validated_new).map_err(|e| format!("Failed to rename file: {}", e))
}

#[tauri::command]
#[specta::specta]
pub async fn create_folder(path: String, vault_path: String) -> Result<(), String> {
    let validated_path = validate_path_within_vault(&path, &vault_path)?;

    if validated_path.exists() {
        return Err(format!("Folder already exists: {}", path));
    }

    fs::create_dir_all(&validated_path).map_err(|e| format!("Failed to create folder: {}", e))
}

#[tauri::command]
#[specta::specta]
pub async fn get_all_notes(vault_path: String) -> Result<Vec<String>, String> {
    let vault = Path::new(&vault_path);

    if !vault.exists() || !vault.is_dir() {
        return Err("Invalid vault path".to_string());
    }

    let mut notes: Vec<String> = Vec::new();

    for entry in WalkDir::new(&vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file() && e.path().extension().map_or(false, |ext| ext == "md"))
    {
        let name = entry
            .path()
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        if !name.is_empty() && !name.starts_with('.') {
            notes.push(name);
        }
    }

    notes.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(notes)
}
