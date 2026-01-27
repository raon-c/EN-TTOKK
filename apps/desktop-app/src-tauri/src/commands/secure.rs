use keyring::Entry;

const JIRA_TOKEN_SERVICE: &str = "com.raonc.en-ttokk";
const JIRA_TOKEN_USERNAME: &str = "jira-api-token";

#[tauri::command]
#[specta::specta]
pub async fn get_jira_token() -> Result<Option<String>, String> {
    let entry = Entry::new(JIRA_TOKEN_SERVICE, JIRA_TOKEN_USERNAME)
        .map_err(|error| error.to_string())?;

    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn set_jira_token(token: String) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("API token is required".to_string());
    }
    if token.len() > 4096 {
        return Err("API token is too long".to_string());
    }
    let entry = Entry::new(JIRA_TOKEN_SERVICE, JIRA_TOKEN_USERNAME)
        .map_err(|error| error.to_string())?;

    entry
        .set_password(token)
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn remove_jira_token() -> Result<(), String> {
    let entry = Entry::new(JIRA_TOKEN_SERVICE, JIRA_TOKEN_USERNAME)
        .map_err(|error| error.to_string())?;

    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}
