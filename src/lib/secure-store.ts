import { invokeCommand } from "@/lib/platform";

export async function getJiraToken(): Promise<string | null> {
  const token = await invokeCommand<string | null>(
    "get_jira_token",
    undefined,
    {
      fallbackMessage: "Unable to access secure storage",
      source: "backend.secure.jira.get",
      code: "secure_get_token_failed",
      traceArgName: "traceId",
    }
  );
  return token ?? null;
}

export async function setJiraToken(token: string): Promise<void> {
  await invokeCommand<null>(
    "set_jira_token",
    { token },
    {
      fallbackMessage: "Unable to update secure storage",
      source: "backend.secure.jira.set",
      code: "secure_set_token_failed",
      traceArgName: "traceId",
    }
  );
}

export async function removeJiraToken(): Promise<void> {
  await invokeCommand<null>("remove_jira_token", undefined, {
    fallbackMessage: "Unable to clear secure storage",
    source: "backend.secure.jira.remove",
    code: "secure_remove_token_failed",
    traceArgName: "traceId",
  });
}
