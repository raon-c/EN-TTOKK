// This module is only used in release builds
#![allow(dead_code)]

use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

// Global state to hold the sidecar process
pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

#[cfg(not(debug_assertions))]
pub fn spawn_backend(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar_command = app.shell().sidecar("backend")?;

    let (mut rx, child) = sidecar_command.spawn()?;

    // Store the child process in state
    let state = app.state::<SidecarState>();
    *state.child.lock().unwrap() = Some(child);

    // Spawn a task to handle sidecar output
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    println!("[backend] {}", line_str);
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    eprintln!("[backend] {}", line_str);
                }
                CommandEvent::Error(err) => {
                    eprintln!("[backend] Error: {}", err);
                }
                CommandEvent::Terminated(payload) => {
                    println!(
                        "[backend] Terminated with code: {:?}, signal: {:?}",
                        payload.code, payload.signal
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    println!("Backend sidecar started successfully");
    Ok(())
}

#[cfg(not(debug_assertions))]
pub fn kill_backend(app: &tauri::AppHandle) {
    let state = app.state::<SidecarState>();
    let child = state.child.lock().unwrap().take();
    if let Some(child) = child {
        let _ = child.kill();
        println!("Backend sidecar killed");
    }
}
