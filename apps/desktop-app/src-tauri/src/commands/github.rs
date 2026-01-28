use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::io::ErrorKind;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum GitHubActivityKind {
    Commit,
    PullRequest,
    Review,
    Comment,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct GitHubActivityItem {
    pub kind: GitHubActivityKind,
    pub title: String,
    pub url: String,
    pub repo: String,
    pub timestamp: String,
    pub number: Option<u64>,
    pub summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct GitHubActivityResponse {
    pub login: String,
    pub date: String,
    pub items: Vec<GitHubActivityItem>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse<T> {
    items: Vec<T>,
}

#[derive(Debug, Deserialize)]
struct SearchIssueItem {
    title: String,
    html_url: String,
    number: u64,
    repository_url: String,
    updated_at: String,
    created_at: String,
    pull_request: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct SearchCommitItem {
    sha: String,
    html_url: String,
    commit: CommitInfo,
    repository: RepositoryInfo,
}

#[derive(Debug, Deserialize)]
struct CommitInfo {
    message: String,
    author: Option<CommitAuthor>,
    committer: Option<CommitAuthor>,
}

#[derive(Debug, Deserialize)]
struct CommitAuthor {
    date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RepositoryInfo {
    full_name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_github_activity(date: String) -> Result<GitHubActivityResponse, String> {
    let date = date.trim().to_string();
    validate_date(&date)?;

    let response = tauri::async_runtime::spawn_blocking(move || fetch_activity(&date))
        .await
        .map_err(|error| format!("GitHub activity task failed: {}", error))??;

    Ok(response)
}

fn validate_date(date: &str) -> Result<(), String> {
    let re = Regex::new(r"^\d{4}-\d{2}-\d{2}$").map_err(|e| e.to_string())?;
    if !re.is_match(date) {
        return Err("Date must be in YYYY-MM-DD format".to_string());
    }
    Ok(())
}

fn validate_login(login: &str) -> Result<(), String> {
    let re = Regex::new(r"^[A-Za-z0-9-]+$").map_err(|e| e.to_string())?;
    if !re.is_match(login) {
        return Err("Unexpected GitHub login format".to_string());
    }
    Ok(())
}

fn fetch_activity(date: &str) -> Result<GitHubActivityResponse, String> {
    let login = fetch_login()?;
    validate_login(&login)?;

    let mut items = Vec::new();
    items.extend(fetch_commits(&login, date)?);
    items.extend(fetch_pull_requests(&login, date)?);
    items.extend(fetch_reviews(&login, date)?);
    items.extend(fetch_comments(&login, date)?);

    items.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(GitHubActivityResponse {
        login,
        date: date.to_string(),
        items,
    })
}

fn fetch_login() -> Result<String, String> {
    let output = run_gh(&["api", "user", "--jq", ".login"])?;
    let login = output.trim().to_string();
    if login.is_empty() {
        return Err("GitHub login not available. Run `gh auth login`.".to_string());
    }
    Ok(login)
}

fn fetch_commits(login: &str, date: &str) -> Result<Vec<GitHubActivityItem>, String> {
    let query = format!("author:{} author-date:{}", login, date);
    let output = run_gh(&[
        "api",
        "/search/commits",
        "-X",
        "GET",
        "-H",
        "Accept: application/vnd.github.cloak-preview+json",
        "-f",
        &format!("q={}", query),
        "-f",
        "per_page=100",
    ])?;

    let response: SearchResponse<SearchCommitItem> =
        serde_json::from_str(&output).map_err(|e| format!("Invalid commit data: {}", e))?;

    Ok(response
        .items
        .into_iter()
        .map(|item| {
            let title = item
                .commit
                .message
                .lines()
                .next()
                .unwrap_or("Commit")
                .trim()
                .to_string();
            let timestamp = item
                .commit
                .author
                .as_ref()
                .and_then(|author| author.date.clone())
                .or_else(|| {
                    item.commit
                        .committer
                        .as_ref()
                        .and_then(|committer| committer.date.clone())
                })
                .unwrap_or_else(|| date.to_string());
            let summary = item.sha.chars().take(7).collect::<String>();

            GitHubActivityItem {
                kind: GitHubActivityKind::Commit,
                title,
                url: item.html_url,
                repo: item.repository.full_name,
                timestamp,
                number: None,
                summary: Some(summary),
            }
        })
        .collect())
}

fn fetch_pull_requests(login: &str, date: &str) -> Result<Vec<GitHubActivityItem>, String> {
    let query = format!("is:pr author:{} created:{}", login, date);
    let output = run_gh(&[
        "api",
        "/search/issues",
        "-X",
        "GET",
        "-f",
        &format!("q={}", query),
        "-f",
        "per_page=100",
    ])?;

    let response: SearchResponse<SearchIssueItem> =
        serde_json::from_str(&output).map_err(|e| format!("Invalid PR data: {}", e))?;

    Ok(response
        .items
        .into_iter()
        .map(|item| GitHubActivityItem {
            kind: GitHubActivityKind::PullRequest,
            title: clean_title(item.title, "Untitled pull request"),
            url: item.html_url,
            repo: repo_from_api_url(&item.repository_url),
            timestamp: item.created_at,
            number: Some(item.number),
            summary: Some(format!("#{}", item.number)),
        })
        .collect())
}

fn fetch_reviews(login: &str, date: &str) -> Result<Vec<GitHubActivityItem>, String> {
    let query = format!("is:pr reviewed-by:{} updated:{}", login, date);
    let output = run_gh(&[
        "api",
        "/search/issues",
        "-X",
        "GET",
        "-f",
        &format!("q={}", query),
        "-f",
        "per_page=100",
    ])?;

    let response: SearchResponse<SearchIssueItem> =
        serde_json::from_str(&output).map_err(|e| format!("Invalid review data: {}", e))?;

    Ok(response
        .items
        .into_iter()
        .map(|item| GitHubActivityItem {
            kind: GitHubActivityKind::Review,
            title: clean_title(item.title, "Untitled review"),
            url: item.html_url,
            repo: repo_from_api_url(&item.repository_url),
            timestamp: item.updated_at,
            number: Some(item.number),
            summary: Some(format!("#{}", item.number)),
        })
        .collect())
}

fn fetch_comments(login: &str, date: &str) -> Result<Vec<GitHubActivityItem>, String> {
    let query = format!("commenter:{} updated:{}", login, date);
    let output = run_gh(&[
        "api",
        "/search/issues",
        "-X",
        "GET",
        "-f",
        &format!("q={}", query),
        "-f",
        "per_page=100",
    ])?;

    let response: SearchResponse<SearchIssueItem> =
        serde_json::from_str(&output).map_err(|e| format!("Invalid comment data: {}", e))?;

    Ok(response
        .items
        .into_iter()
        .map(|item| {
            let is_pr = item.pull_request.is_some();
            let label = if is_pr { "PR" } else { "Issue" };
            GitHubActivityItem {
                kind: GitHubActivityKind::Comment,
                title: clean_title(item.title, "Untitled comment"),
                url: item.html_url,
                repo: repo_from_api_url(&item.repository_url),
                timestamp: item.updated_at,
                number: Some(item.number),
                summary: Some(format!("{} #{}", label, item.number)),
            }
        })
        .collect())
}

fn clean_title(value: String, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn repo_from_api_url(url: &str) -> String {
    if let Some(repo) = url.split("/repos/").nth(1) {
        return repo.to_string();
    }
    url.to_string()
}

fn run_gh(args: &[&str]) -> Result<String, String> {
    let output = Command::new("gh")
        .env("GH_PROMPT_DISABLED", "1")
        .env("GH_NO_UPDATE_NOTIFIER", "1")
        .args(args)
        .output()
        .map_err(|error| match error.kind() {
            ErrorKind::NotFound => {
                "GitHub CLI (gh) not found. Install from https://cli.github.com/".to_string()
            }
            _ => format!("Failed to run gh: {}", error),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "GitHub CLI request failed".to_string()
        } else {
            stderr
        });
    }

    String::from_utf8(output.stdout)
        .map_err(|error| format!("GitHub CLI returned invalid UTF-8: {}", error))
}
