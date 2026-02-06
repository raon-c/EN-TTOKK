import { listen } from "@tauri-apps/api/event";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { commands } from "@/bindings";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { useDailyNotesStore } from "@/features/daily-notes/store/dailyNotesStore";
import { GoogleCalendarSync } from "@/features/google-calendar";
import { SettingsDialog, useSettingsStore } from "@/features/settings";
import { VaultPicker } from "@/features/vault/components/VaultPicker";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { useBackend } from "@/hooks/useBackend";
import { EditorLayout } from "@/layouts/EditorLayout";

function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-muted-foreground">{message}</div>
    </div>
  );
}

function BackendErrorScreen({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="text-destructive">{error}</div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Retry
      </button>
    </div>
  );
}

function ThemeSynchronizer() {
  const { setTheme } = useTheme();
  const { settings } = useSettingsStore();

  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme, setTheme]);

  return null;
}

function AppContent() {
  const { path, _hasHydrated, openVault, closeVault, loadVault } =
    useVaultStore();
  const {
    loadSettings,
    _hasHydrated: settingsHydrated,
    settings,
  } = useSettingsStore();
  const { openOrCreateDailyNote } = useDailyNotesStore();
  const {
    status: backendStatus,
    error: backendError,
    retry: retryBackend,
  } = useBackend();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasAttemptedAutoOpen = useRef(false);

  // Load settings and vault on mount
  useEffect(() => {
    loadSettings();
    loadVault();
  }, [loadSettings, loadVault]);

  // Listen for menu events
  useEffect(() => {
    const unlisten = listen("open-settings", () => {
      setSettingsOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Keyboard shortcut: Command + , to open settings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!_hasHydrated || hasAttemptedAutoOpen.current) return;
    hasAttemptedAutoOpen.current = true;

    if (!path) {
      setIsValidating(false);
      return;
    }

    commands
      .validateVaultPath(path)
      .then(() => openVault(path))
      .then(() => {
        const currentActiveNote = useVaultStore.getState().activeNote;
        if (currentActiveNote === null) {
          openOrCreateDailyNote(new Date(), settings.dailyNotes).catch(
            () => {}
          );
        }
      })
      .catch(() => {
        setValidationError("이전 vault를 찾을 수 없습니다");
        closeVault();
      })
      .finally(() => setIsValidating(false));
  }, [
    _hasHydrated,
    path,
    openVault,
    closeVault,
    openOrCreateDailyNote,
    settings.dailyNotes,
  ]);

  if (backendStatus === "connecting") {
    return <LoadingScreen message="Connecting to backend..." />;
  }

  if (backendStatus === "error") {
    return (
      <BackendErrorScreen
        error={backendError ?? "Failed to connect to backend"}
        onRetry={retryBackend}
      />
    );
  }

  if (!_hasHydrated || !settingsHydrated || isValidating) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ThemeSynchronizer />
      <GoogleCalendarSync />
      {!path || validationError ? (
        <VaultPicker initialError={validationError} />
      ) : (
        <EditorLayout />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
