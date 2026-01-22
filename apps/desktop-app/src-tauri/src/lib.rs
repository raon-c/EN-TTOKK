mod commands;

use commands::{
    create_file, create_folder, create_vault, delete_file, get_all_notes, open_vault,
    read_directory, read_file, rename_file, validate_vault_path, write_file,
};
use specta_typescript::{BigIntExportBehavior, Typescript};
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
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
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
