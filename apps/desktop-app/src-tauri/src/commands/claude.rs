use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum ClaudeActivityKind {
    User,
    Assistant,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ClaudeActivityItem {
    pub kind: ClaudeActivityKind,
    pub content: String,
    pub timestamp: String,
    pub project_path: String,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ClaudeActivityResponse {
    pub date: String,
    pub items: Vec<ClaudeActivityItem>,
}

#[derive(Debug, Deserialize)]
struct JsonlRecord {
    #[serde(rename = "type")]
    record_type: Option<String>,
    timestamp: Option<String>,
    message: Option<MessageContent>,
    cwd: Option<String>,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum MessageContent {
    Simple(String),
    Complex(ComplexMessage),
}

#[derive(Debug, Deserialize)]
struct ComplexMessage {
    content: Option<MessageBody>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum MessageBody {
    Text(String),
    Array(Vec<ContentBlock>),
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: Option<String>,
    text: Option<String>,
}

fn get_claude_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".claude"))
}

/// Extract actual project path from JSONL files in the project directory.
/// The folder name encoding is ambiguous (both '/' and '.' become '-'),
/// so we read the `cwd` field from the first JSONL record instead.
fn extract_project_path_from_dir(project_dir: &PathBuf) -> Option<String> {
    let jsonl_entries = fs::read_dir(project_dir).ok()?;

    for entry in jsonl_entries.flatten() {
        let path = entry.path();
        if !path.extension().map(|e| e == "jsonl").unwrap_or(false) {
            continue;
        }

        let content = fs::read_to_string(&path).ok()?;
        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(record) = serde_json::from_str::<JsonlRecord>(line) {
                if let Some(cwd) = record.cwd {
                    return Some(cwd);
                }
            }
        }
    }

    None
}

fn parse_date(date: &str) -> Result<(i32, u32, u32), String> {
    let re = Regex::new(r"^(\d{4})-(\d{2})-(\d{2})$").map_err(|e| e.to_string())?;
    let caps = re.captures(date).ok_or("Date must be in YYYY-MM-DD format")?;

    let year: i32 = caps[1].parse().map_err(|_| "Invalid year")?;
    let month: u32 = caps[2].parse().map_err(|_| "Invalid month")?;
    let day: u32 = caps[3].parse().map_err(|_| "Invalid day")?;

    Ok((year, month, day))
}

/// Parse ISO 8601 timestamp and extract date components in KST timezone.
/// Format: "2026-01-22T05:08:51.202Z"
fn parse_iso_timestamp(timestamp: &str) -> Option<(i32, u32, u32, u32, u32)> {
    // Extract date and time parts from ISO string
    let re = Regex::new(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})").ok()?;
    let caps = re.captures(timestamp)?;

    let year: i32 = caps[1].parse().ok()?;
    let month: u32 = caps[2].parse().ok()?;
    let day: u32 = caps[3].parse().ok()?;
    let hour: u32 = caps[4].parse().ok()?;
    let minute: u32 = caps[5].parse().ok()?;

    // Convert UTC to KST (UTC+9)
    let kst_hour = hour + 9;
    if kst_hour >= 24 {
        // Day overflow - move to next day
        let (new_year, new_month, new_day) = add_one_day(year, month, day);
        Some((new_year, new_month, new_day, kst_hour - 24, minute))
    } else {
        Some((year, month, day, kst_hour, minute))
    }
}

fn add_one_day(year: i32, month: u32, day: u32) -> (i32, u32, u32) {
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 31,
    };

    if day < days_in_month {
        (year, month, day + 1)
    } else if month < 12 {
        (year, month + 1, 1)
    } else {
        (year + 1, 1, 1)
    }
}

fn timestamp_matches_date(timestamp: &str, year: i32, month: u32, day: u32) -> bool {
    if let Some((y, m, d, _, _)) = parse_iso_timestamp(timestamp) {
        y == year && m == month && d == day
    } else {
        false
    }
}

fn timestamp_in_month(timestamp: &str, year: i32, month: u32) -> Option<u32> {
    if let Some((y, m, d, _, _)) = parse_iso_timestamp(timestamp) {
        if y == year && m == month {
            return Some(d);
        }
    }
    None
}

fn extract_content(message: &MessageContent) -> String {
    match message {
        MessageContent::Simple(s) => s.clone(),
        MessageContent::Complex(c) => match &c.content {
            Some(MessageBody::Text(t)) => t.clone(),
            Some(MessageBody::Array(blocks)) => {
                blocks
                    .iter()
                    .filter_map(|block| {
                        if block.block_type.as_deref() == Some("text") {
                            block.text.clone()
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            None => String::new(),
        },
    }
}

fn should_include_record(record_type: &str) -> bool {
    matches!(record_type, "user" | "assistant")
}

fn read_jsonl_activities(
    path: &PathBuf,
    date: &str,
    subscribed_folders: &[String],
) -> Result<Vec<ClaudeActivityItem>, String> {
    let (year, month, day) = parse_date(date)?;
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let mut items = Vec::new();

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let record: JsonlRecord = match serde_json::from_str(line) {
            Ok(r) => r,
            Err(_) => continue, // Skip invalid lines
        };

        let record_type = match &record.record_type {
            Some(t) => t.as_str(),
            None => continue,
        };

        if !should_include_record(record_type) {
            continue;
        }

        let timestamp = match &record.timestamp {
            Some(t) => t.as_str(),
            None => continue,
        };

        if !timestamp_matches_date(timestamp, year, month, day) {
            continue;
        }

        // Get cwd from record - skip if not present
        let cwd = match &record.cwd {
            Some(c) => c.as_str(),
            None => continue,
        };

        // Check if project is in subscribed folders
        let is_subscribed = subscribed_folders.is_empty()
            || subscribed_folders.iter().any(|folder| cwd.starts_with(folder));

        if !is_subscribed {
            continue;
        }

        let content = match &record.message {
            Some(msg) => extract_content(msg),
            None => continue,
        };

        if content.is_empty() {
            continue;
        }

        let kind = match record_type {
            "user" => ClaudeActivityKind::User,
            "assistant" => ClaudeActivityKind::Assistant,
            _ => continue,
        };

        items.push(ClaudeActivityItem {
            kind,
            content,
            timestamp: timestamp.to_string(),
            project_path: cwd.to_string(),
            session_id: record.session_id.unwrap_or_default(),
        });
    }

    Ok(items)
}

#[tauri::command]
#[specta::specta]
pub async fn list_claude_projects() -> Result<Vec<String>, String> {
    let claude_dir = get_claude_dir()?;
    let projects_dir = claude_dir.join("projects");

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = HashSet::new();

    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;

    for entry in entries.flatten() {
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let project_dir = entry.path();
            if let Some(path) = extract_project_path_from_dir(&project_dir) {
                projects.insert(path);
            }
        }
    }

    let mut projects: Vec<String> = projects.into_iter().collect();
    projects.sort();
    Ok(projects)
}

#[tauri::command]
#[specta::specta]
pub async fn get_claude_activities(
    date: String,
    subscribed_folders: Vec<String>,
) -> Result<ClaudeActivityResponse, String> {
    let date = date.trim().to_string();
    parse_date(&date)?; // Validate date format

    // Return empty if no folders subscribed
    if subscribed_folders.is_empty() {
        return Ok(ClaudeActivityResponse {
            date,
            items: Vec::new(),
        });
    }

    let claude_dir = get_claude_dir()?;
    let projects_dir = claude_dir.join("projects");

    let mut all_items = Vec::new();

    if projects_dir.exists() {
        let entries = fs::read_dir(&projects_dir)
            .map_err(|e| format!("Failed to read projects directory: {}", e))?;

        for entry in entries.flatten() {
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }

            let project_dir = entry.path();

            // Early filter: skip projects that don't match subscribed folders
            if !subscribed_folders.is_empty() {
                if let Some(project_path) = extract_project_path_from_dir(&project_dir) {
                    let matches = subscribed_folders
                        .iter()
                        .any(|folder| project_path.starts_with(folder));
                    if !matches {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            let jsonl_entries = fs::read_dir(&project_dir);

            if let Ok(jsonl_entries) = jsonl_entries {
                for jsonl_entry in jsonl_entries.flatten() {
                    let path = jsonl_entry.path();
                    if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                        if let Ok(items) = read_jsonl_activities(
                            &path,
                            &date,
                            &subscribed_folders,
                        ) {
                            all_items.extend(items);
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp descending (newest first)
    all_items.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(ClaudeActivityResponse {
        date,
        items: all_items,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_claude_activity_dates(
    subscribed_folders: Vec<String>,
    year: i32,
    month: u32,
) -> Result<Vec<u32>, String> {
    if month < 1 || month > 12 {
        return Err("Month must be between 1 and 12".to_string());
    }

    // Return empty if no folders subscribed
    if subscribed_folders.is_empty() {
        return Ok(Vec::new());
    }

    let claude_dir = get_claude_dir()?;
    let projects_dir = claude_dir.join("projects");

    let mut days_with_activity: HashSet<u32> = HashSet::new();

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;

    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }

        let project_dir = entry.path();

        // Early filter: skip projects that don't match subscribed folders
        if !subscribed_folders.is_empty() {
            if let Some(project_path) = extract_project_path_from_dir(&project_dir) {
                let matches = subscribed_folders
                    .iter()
                    .any(|folder| project_path.starts_with(folder));
                if !matches {
                    continue;
                }
            } else {
                continue;
            }
        }

        let jsonl_entries = fs::read_dir(&project_dir);

        if let Ok(jsonl_entries) = jsonl_entries {
            for jsonl_entry in jsonl_entries.flatten() {
                let path = jsonl_entry.path();
                if !path.extension().map(|e| e == "jsonl").unwrap_or(false) {
                    continue;
                }

                let content = match fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                for line in content.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }

                    let record: JsonlRecord = match serde_json::from_str(line) {
                        Ok(r) => r,
                        Err(_) => continue,
                    };

                    let record_type = match &record.record_type {
                        Some(t) => t.as_str(),
                        None => continue,
                    };

                    if !should_include_record(record_type) {
                        continue;
                    }

                    // Filter by subscribed folders using cwd field
                    if !subscribed_folders.is_empty() {
                        let cwd = match &record.cwd {
                            Some(c) => c.as_str(),
                            None => continue,
                        };
                        let is_subscribed = subscribed_folders
                            .iter()
                            .any(|folder| cwd.starts_with(folder));
                        if !is_subscribed {
                            continue;
                        }
                    }

                    if let Some(ref timestamp) = record.timestamp {
                        if let Some(day) = timestamp_in_month(timestamp, year, month) {
                            days_with_activity.insert(day);
                        }
                    }
                }
            }
        }
    }

    let mut days: Vec<u32> = days_with_activity.into_iter().collect();
    days.sort();
    Ok(days)
}
