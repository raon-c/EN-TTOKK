import { format, isValid, parseISO } from "date-fns";
import { LogOut, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarContent } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useJiraStore } from "../store/jiraStore";

const getIssueUpdatedKey = (updated?: string) => {
  if (!updated) return null;
  const parsed = parseISO(updated);
  if (!isValid(parsed)) return null;
  return format(parsed, "yyyy-MM-dd");
};

export function JiraPanel() {
  const {
    status,
    error,
    baseUrl,
    email,
    apiToken,
    issues,
    isLoadingIssues,
    hasStoredToken,
    setBaseUrl,
    setEmail,
    setApiToken,
    loadFromStore,
    save,
    testConnection,
    fetchIssues,
    disconnect,
  } = useJiraStore();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  useEffect(() => {
    loadFromStore();
  }, [loadFromStore]);

  const isConnecting = status === "connecting";
  const canSave = Boolean(baseUrl.trim() && email.trim());
  const hasToken = Boolean(apiToken.trim() || hasStoredToken);
  const canTest = Boolean(baseUrl.trim() && email.trim() && hasToken);
  const canFetch = canTest;
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDateLabel = format(selectedDate, "MMM d, yyyy");
  const filteredIssues = useMemo(
    () =>
      issues.filter(
        (issue) => getIssueUpdatedKey(issue.updated) === selectedDateKey
      ),
    [issues, selectedDateKey]
  );

  return (
    <SidebarContent>
      <div className="space-y-3 px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">Jira</div>
          </div>
          <div className="flex items-center gap-2">
            {status === "connected" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchIssues}
                  disabled={isConnecting || !canFetch}
                  title="Refresh issues"
                >
                  <RefreshCw
                    className={cn("size-3", isLoadingIssues && "animate-spin")}
                  />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={disconnect}
                  disabled={isConnecting}
                  title="Disconnect"
                >
                  <LogOut className="size-3" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={save}
                  disabled={isConnecting || !canSave}
                  title="Save credentials"
                >
                  <Save className="size-3" />
                </Button>
                <Button
                  size="sm"
                  onClick={testConnection}
                  disabled={isConnecting || !canTest}
                  title="Test connection"
                >
                  <ShieldCheck className="size-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>

      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => date && setSelectedDate(date)}
        disabled={status !== "connected"}
        className="w-full bg-sidebar"
      />

      <Separator className="my-3" />

      {status !== "connected" && (
        <div className="space-y-3 px-3 pb-4">
          <div className="space-y-1">
            <Label htmlFor="jira-base-url">Base URL</Label>
            <Input
              id="jira-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://your-domain.atlassian.net"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="jira-email">Email</Label>
            <Input
              id="jira-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="jira-token">API Token</Label>
            <Input
              id="jira-token"
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              placeholder="Jira API token"
            />
            <div className="text-xs text-muted-foreground">
              API tokens are stored securely in the OS keychain.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 px-3 pb-4">
        <div className="text-sm font-medium">Issues on {selectedDateLabel}</div>
        {isLoadingIssues ? (
          <div className="text-xs text-muted-foreground">Loading issues...</div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No issues for this date.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIssues.map((issue) => (
              <div
                key={issue.key}
                className="rounded-lg border bg-card px-3 py-2 text-sm shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{issue.key}</div>
                  <Badge variant="outline" className="text-[10px]">
                    {issue.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {issue.summary}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {issue.assignee ? `Assignee: ${issue.assignee}` : ""}
                  {issue.updated
                    ? `${issue.assignee ? " · " : ""}Updated: ${new Date(
                        issue.updated
                      ).toLocaleString()}`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarContent>
  );
}
