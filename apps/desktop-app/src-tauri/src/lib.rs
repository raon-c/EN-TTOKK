mod commands;

use commands::{
    create_file, create_folder, create_vault, delete_file, get_all_notes, open_vault,
    read_directory, read_file, rename_file, validate_vault_path, write_file,
};
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri::{
    menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter,
};
use tauri_specta::{collect_commands, Builder};

#[tauri::command]
#[specta::specta]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn create_specta_builder() -> Builder {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        greet,
        // Vault commands
        open_vault,
        create_vault,
        validate_vault_path,
        // File commands
        read_directory,
        read_file,
        write_file,
        create_file,
        delete_file,
        rename_file,
        create_folder,
        get_all_notes,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = create_specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default()
                .bigint(BigIntExportBehavior::Number)
                .header("// @ts-nocheck"),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            // Create app menu with Settings item
            let app_menu = SubmenuBuilder::new(app, "en-ttokk")
                .item(&PredefinedMenuItem::about(app, Some("About EN:TTOKK"), None)?)
                .separator()
                .text("settings", "Settings...")
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            // Create Edit menu (standard macOS edit menu)
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // Create Window menu
            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu, &window_menu])
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app_handle, event| {
                if event.id().0.as_str() == "settings" {
                    let _ = app_handle.emit("open-settings", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings() {
        let builder = create_specta_builder();
        builder
            .export(
                Typescript::default()
                    .bigint(BigIntExportBehavior::Number)
                    .header("// @ts-nocheck"),
                "../src/bindings.ts",
            )
            .expect("Failed to export typescript bindings");
    }
}
