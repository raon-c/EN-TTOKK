import { useTheme } from "next-themes";
import { useEffect } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { useAppOrchestration } from "@/features/app/hooks/useAppOrchestration";
import { GoogleCalendarSync } from "@/features/google-calendar/components/GoogleCalendarSync";
import { SettingsDialog } from "@/features/settings/components/SettingsDialog";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { VaultPicker } from "@/features/vault/components/VaultPicker";
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
  const {
    status: backendStatus,
    error: backendError,
    retry: retryBackend,
  } = useBackend();
  const {
    path,
    vaultHydrated,
    settingsHydrated,
    isValidating,
    validationError,
    settingsOpen,
    setSettingsOpen,
  } = useAppOrchestration();

  if (backendStatus === "connecting") {
    return <LoadingScreen message="Connecting to app service..." />;
  }

  if (backendStatus === "error") {
    return (
      <BackendErrorScreen
        error={backendError ?? "Failed to connect to app service"}
        onRetry={retryBackend}
      />
    );
  }

  if (!vaultHydrated || !settingsHydrated || isValidating) {
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
