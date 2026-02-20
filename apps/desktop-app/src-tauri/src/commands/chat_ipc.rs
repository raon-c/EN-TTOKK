use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

type SharedChild = Arc<Mutex<Child>>;

const CHAT_STREAM_EVENT: &str = "chat-stream-chunk";

static ACTIVE_CHAT_STREAMS: OnceLock<Mutex<HashMap<String, SharedChild>>> = OnceLock::new();
static CANCELLED_CHAT_STREAMS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamStartInput {
    pub request_id: String,
    pub message: String,
    pub working_directory: Option<String>,
    pub session_id: Option<String>,
    pub system_prompt: Option<String>,
    pub conversation_id: Option<String>,
}

#[derive(Debug, Serialize, specta::Type)]
pub struct ChatStatusResponse {
    pub status: String,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolUseChunk {
    id: String,
    name: String,
    input: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FrontendStreamChunk {
    #[serde(rename = "type")]
    chunk_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool: Option<ToolUseChunk>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_result: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatStreamEventPayload {
    request_id: String,
    chunk: FrontendStreamChunk,
}

fn active_chat_streams() -> &'static Mutex<HashMap<String, SharedChild>> {
    ACTIVE_CHAT_STREAMS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cancelled_chat_streams() -> &'static Mutex<HashSet<String>> {
    CANCELLED_CHAT_STREAMS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn is_cancelled(request_id: &str) -> bool {
    cancelled_chat_streams()
        .lock()
        .map(|cancelled| cancelled.contains(request_id))
        .unwrap_or(false)
}

fn cleanup_stream(request_id: &str) {
    if let Ok(mut streams) = active_chat_streams().lock() {
        streams.remove(request_id);
    }
    if let Ok(mut cancelled) = cancelled_chat_streams().lock() {
        cancelled.remove(request_id);
    }
}

fn emit_chunk(app: &AppHandle, request_id: &str, chunk: FrontendStreamChunk) {
    let payload = ChatStreamEventPayload {
        request_id: request_id.to_string(),
        chunk,
    };
    let _ = app.emit(CHAT_STREAM_EVENT, payload);
}

fn make_chunk(
    chunk_type: &str,
    text: Option<String>,
    thinking: Option<String>,
    tool: Option<ToolUseChunk>,
    tool_result: Option<String>,
    session_id: Option<String>,
    error: Option<String>,
) -> FrontendStreamChunk {
    FrontendStreamChunk {
        chunk_type: chunk_type.to_string(),
        text,
        thinking,
        tool,
        tool_result,
        session_id,
        error,
    }
}

fn parse_text_from_value(value: Option<&Value>) -> Option<String> {
    let target = value?;
    if let Some(text) = target.as_str() {
        return Some(text.to_string());
    }
    if let Some(items) = target.as_array() {
        let texts = items
            .iter()
            .filter_map(|item| item.get("text").and_then(Value::as_str))
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        if !texts.is_empty() {
            return Some(texts.join("\n"));
        }
    }
    Some(target.to_string())
}

fn parse_assistant_chunks(event: &Value) -> Vec<FrontendStreamChunk> {
    let mut chunks = Vec::new();

    let Some(content) = event
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_array)
    else {
        return chunks;
    };

    for block in content {
        let Some(block_type) = block.get("type").and_then(Value::as_str) else {
            continue;
        };

        match block_type {
            "text" => {
                if let Some(text) = block.get("text").and_then(Value::as_str) {
                    chunks.push(make_chunk(
                        "text_delta",
                        Some(text.to_string()),
                        None,
                        None,
                        None,
                        None,
                        None,
                    ));
                }
            }
            "thinking" => {
                if let Some(thinking) = block.get("thinking").and_then(Value::as_str) {
                    chunks.push(make_chunk(
                        "thinking",
                        None,
                        Some(thinking.to_string()),
                        None,
                        None,
                        None,
                        None,
                    ));
                }
            }
            "tool_use" => {
                let tool = ToolUseChunk {
                    id: block
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    name: block
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or("unknown")
                        .to_string(),
                    input: block.get("input").cloned().unwrap_or_else(|| json!({})),
                };
                chunks.push(make_chunk(
                    "tool_use",
                    None,
                    None,
                    Some(tool),
                    None,
                    None,
                    None,
                ));
            }
            "tool_result" => {
                let tool_result = parse_text_from_value(block.get("content"))
                    .or_else(|| parse_text_from_value(block.get("text")));
                chunks.push(make_chunk(
                    "tool_result",
                    None,
                    None,
                    None,
                    tool_result,
                    None,
                    None,
                ));
            }
            _ => {}
        }
    }

    chunks
}

fn parse_stream_line(line: &str) -> Vec<FrontendStreamChunk> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let Ok(event) = serde_json::from_str::<Value>(trimmed) else {
        return Vec::new();
    };

    let Some(event_type) = event.get("type").and_then(Value::as_str) else {
        return Vec::new();
    };

    match event_type {
        "system" => {
            let session_id = event
                .get("session_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            vec![make_chunk("start", None, None, None, None, session_id, None)]
        }
        "assistant" => parse_assistant_chunks(&event),
        "result" => {
            let session_id = event
                .get("session_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            vec![make_chunk("done", None, None, None, None, session_id, None)]
        }
        "error" => {
            let error = event
                .get("error")
                .and_then(|err| err.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Unknown error")
                .to_string();
            vec![make_chunk("error", None, None, None, None, None, Some(error))]
        }
        _ => Vec::new(),
    }
}

fn validate_chat_start_input(input: &ChatStreamStartInput) -> Result<(), String> {
    let message = input.message.trim();
    if message.is_empty() {
        return Err("Message is required".to_string());
    }
    if message.len() > 100000 {
        return Err("Message too long".to_string());
    }

    if input.request_id.trim().is_empty() {
        return Err("requestId is required".to_string());
    }

    if let Some(path) = &input.working_directory {
        if path.contains("..") {
            return Err("Path cannot contain directory traversal sequences".to_string());
        }
        if path.contains('\0') {
            return Err("Path cannot contain null bytes".to_string());
        }
    }

    Ok(())
}

fn spawn_claude_process(input: &ChatStreamStartInput) -> Result<Child, String> {
    let mut command = Command::new("claude");
    command
        .arg("--output-format")
        .arg("stream-json")
        .arg("--verbose");

    // NOTE: system_prompt is currently ignored to preserve existing behavior
    // from the previous backend implementation.
    let _system_prompt = &input.system_prompt;
    let _conversation_id = &input.conversation_id;

    if let Some(session_id) = &input.session_id {
        if !session_id.trim().is_empty() {
            command.arg("--resume").arg(session_id.trim());
        }
    }

    command.arg("-p").arg(input.message.trim());

    if let Some(cwd) = &input.working_directory {
        if !cwd.trim().is_empty() {
            command.current_dir(cwd.trim());
        }
    }

    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    command
        .spawn()
        .map_err(|error| format!("Failed to spawn Claude CLI: {}", error))
}

fn stream_worker(
    app: AppHandle,
    request_id: String,
    child_handle: SharedChild,
    stdout: impl Read,
    mut stderr: impl Read,
) {
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();

    loop {
        if is_cancelled(&request_id) {
            cleanup_stream(&request_id);
            return;
        }

        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                for chunk in parse_stream_line(&line) {
                    emit_chunk(&app, &request_id, chunk);
                }
            }
            Err(error) => {
                emit_chunk(
                    &app,
                    &request_id,
                    make_chunk(
                        "error",
                        None,
                        None,
                        None,
                        None,
                        None,
                        Some(format!("Failed to read Claude output: {}", error)),
                    ),
                );
                break;
            }
        }
    }

    let status = child_handle.lock().ok().and_then(|mut child| child.wait().ok());
    let was_cancelled = is_cancelled(&request_id);

    let mut stderr_text = String::new();
    let _ = stderr.read_to_string(&mut stderr_text);

    if !was_cancelled && !status.map(|s| s.success()).unwrap_or(false) {
        let error_message = if stderr_text.trim().is_empty() {
            "Claude CLI request failed".to_string()
        } else {
            stderr_text.trim().to_string()
        };
        emit_chunk(
            &app,
            &request_id,
            make_chunk("error", None, None, None, None, None, Some(error_message)),
        );
    }

    cleanup_stream(&request_id);
}

#[tauri::command]
#[specta::specta]
pub async fn chat_check_status() -> Result<ChatStatusResponse, String> {
    let output = Command::new("claude")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let version = String::from_utf8_lossy(&result.stdout).trim().to_string();
            Ok(ChatStatusResponse {
                status: "available".to_string(),
                version: if version.is_empty() {
                    None
                } else {
                    Some(version)
                },
                error: None,
            })
        }
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr).trim().to_string();
            Ok(ChatStatusResponse {
                status: "unavailable".to_string(),
                version: None,
                error: if stderr.is_empty() {
                    Some("Claude CLI exited with non-zero code".to_string())
                } else {
                    Some(stderr)
                },
            })
        }
        Err(error) => Ok(ChatStatusResponse {
            status: "unavailable".to_string(),
            version: None,
            error: Some(error.to_string()),
        }),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn chat_start_stream(
    app: AppHandle,
    input: ChatStreamStartInput,
) -> Result<(), String> {
    validate_chat_start_input(&input)?;
    let request_id = input.request_id.clone();

    if let Ok(mut cancelled) = cancelled_chat_streams().lock() {
        cancelled.remove(&request_id);
    }

    let mut child = spawn_claude_process(&input)?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture Claude stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture Claude stderr".to_string())?;

    let child_handle = Arc::new(Mutex::new(child));
    active_chat_streams()
        .lock()
        .map_err(|error| format!("Failed to track active stream: {}", error))?
        .insert(request_id.clone(), child_handle.clone());

    std::thread::spawn(move || {
        stream_worker(app, request_id, child_handle, stdout, stderr);
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn chat_cancel_stream(request_id: String) -> Result<bool, String> {
    cancelled_chat_streams()
        .lock()
        .map_err(|error| format!("Failed to track cancelled stream: {}", error))?
        .insert(request_id.clone());

    let child = active_chat_streams()
        .lock()
        .map_err(|error| format!("Failed to access active streams: {}", error))?
        .remove(&request_id);

    let Some(child_handle) = child else {
        return Ok(false);
    };

    if let Ok(mut child) = child_handle.lock() {
        let _ = child.kill();
    }

    Ok(true)
}
