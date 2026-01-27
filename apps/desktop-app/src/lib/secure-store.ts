import { invoke } from "@tauri-apps/api/core";

export async function getJiraToken(): Promise<string | null> {
  const token = await invoke<string | null>("get_jira_token");
  return token ?? null;
}

export async function setJiraToken(token: string): Promise<void> {
  await invoke("set_jira_token", { token });
}

export async function removeJiraToken(): Promise<void> {
  await invoke("remove_jira_token");
}
