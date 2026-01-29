import { formatInKst } from "@bun-enttokk/shared";
import {
  CheckCircle2,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_DAILY_NOTES_SETTINGS } from "@/features/daily-notes/types";
import { useBackend } from "@/hooks/useBackend";

import { useSettingsStore } from "../store/settingsStore";
import type { Theme } from "../types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function isValidFolderName(name: string): boolean {
  if (!name.trim()) return false;
  // Prevent path traversal: no slashes, backslashes, or parent directory references
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return false;
  }
  // Prevent absolute paths or hidden folders
  if (name.startsWith(".") || name.startsWith("~")) {
    return false;
  }
  return true;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, setTheme, setDailyNotesFolder, setDailyNotesTemplate } =
    useSettingsStore();
  const {
    status: backendStatus,
    error: backendError,
    lastChecked,
    checkHealth,
  } = useBackend();
  const [isChecking, setIsChecking] = React.useState(false);
  const [folderInput, setFolderInput] = React.useState(
    settings.dailyNotes?.folder ?? DEFAULT_DAILY_NOTES_SETTINGS.folder
  );
  const [folderError, setFolderError] = React.useState<string | null>(null);
  const [templateInput, setTemplateInput] = React.useState(
    settings.dailyNotes?.template ?? DEFAULT_DAILY_NOTES_SETTINGS.template
  );

  const handleCheckHealth = async () => {
    setIsChecking(true);
    await checkHealth();
    setIsChecking(false);
  };

  React.useEffect(() => {
    setFolderInput(
      settings.dailyNotes?.folder ?? DEFAULT_DAILY_NOTES_SETTINGS.folder
    );
    setTemplateInput(
      settings.dailyNotes?.template ?? DEFAULT_DAILY_NOTES_SETTINGS.template
    );
    setFolderError(null);
  }, [settings.dailyNotes?.folder, settings.dailyNotes?.template]);

  const handleThemeChange = (value: string) => {
    setTheme(value as Theme);
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFolderInput(e.target.value);
    setFolderError(null);
  };

  const handleFolderBlur = () => {
    const trimmed = folderInput.trim();
    if (!trimmed) {
      setFolderError("Folder name is required");
      return;
    }
    if (!isValidFolderName(trimmed)) {
      setFolderError("Invalid folder name (no /, \\, .., or leading . or ~)");
      return;
    }
    if (trimmed !== settings.dailyNotes?.folder) {
      setDailyNotesFolder(trimmed);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTemplateInput(e.target.value);
  };

  const handleTemplateBlur = () => {
    if (templateInput !== settings.dailyNotes?.template) {
      setDailyNotesTemplate(templateInput);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your application preferences.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Appearance</Label>
              <RadioGroup
                value={settings.theme}
                onValueChange={handleThemeChange}
                className="grid grid-cols-3 gap-2"
              >
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <Label
                    key={value}
                    htmlFor={`theme-${value}`}
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-input p-3 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent"
                  >
                    <RadioGroupItem
                      id={`theme-${value}`}
                      value={value}
                      className="sr-only"
                    />
                    <Icon className="size-5" />
                    <span className="text-xs">{label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Backend Connection</Label>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {backendStatus === "connected" && (
                      <>
                        <CheckCircle2 className="size-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Connected
                        </span>
                      </>
                    )}
                    {backendStatus === "connecting" && (
                      <>
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Connecting...
                        </span>
                      </>
                    )}
                    {backendStatus === "error" && (
                      <>
                        <XCircle className="size-4 text-destructive" />
                        <span className="text-sm text-destructive">
                          Disconnected
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckHealth}
                    disabled={isChecking}
                    className="h-8"
                  >
                    {isChecking ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    <span className="ml-1.5">Check</span>
                  </Button>
                </div>
                {backendError && (
                  <p className="text-xs text-destructive">{backendError}</p>
                )}
                {lastChecked && (
                  <p className="text-xs text-muted-foreground">
                    Last checked: {formatInKst(lastChecked, "HH:mm:ss")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Backend server: http://localhost:31337
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Daily Notes</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="daily-notes-folder"
                    className="text-xs text-muted-foreground"
                  >
                    Folder name for daily notes
                  </Label>
                  <Input
                    id="daily-notes-folder"
                    value={folderInput}
                    onChange={handleFolderChange}
                    onBlur={handleFolderBlur}
                    placeholder="데일리"
                    className={`h-9 ${folderError ? "border-destructive" : ""}`}
                  />
                  {folderError && (
                    <p className="text-xs text-destructive">{folderError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="daily-notes-template"
                    className="text-xs text-muted-foreground"
                  >
                    Template for new daily notes
                  </Label>
                  <Textarea
                    id="daily-notes-template"
                    value={templateInput}
                    onChange={handleTemplateChange}
                    onBlur={handleTemplateBlur}
                    placeholder="# {{date}}"
                    className="min-h-[150px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available variables: {"{{date}}"}, {"{{year}}"},{" "}
                    {"{{month}}"}, {"{{day}}"}, {"{{dayOfWeek}}"},{" "}
                    {"{{dayOfWeekShort}}"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
