import { listen } from "@tauri-apps/api/event";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { commands } from "@/bindings";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SettingsDialog, useSettingsStore } from "@/features/settings";
import { VaultPicker } from "@/features/vault/components/VaultPicker";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { EditorLayout } from "@/layouts/EditorLayout";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-muted-foreground">Loading...</div>
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
  const { loadSettings, _hasHydrated: settingsHydrated } = useSettingsStore();
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
      .catch(() => {
        setValidationError("이전 vault를 찾을 수 없습니다");
        closeVault();
      })
      .finally(() => setIsValidating(false));
  }, [_hasHydrated, path, openVault, closeVault]);

  if (!_hasHydrated || !settingsHydrated || isValidating) {
    return <LoadingScreen />;
  }

  return (
    <>
      <ThemeSynchronizer />
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
    </ThemeProvider>
  );
}

export default App;
