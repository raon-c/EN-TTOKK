import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { commands } from "@/bindings";
import { useDailyNotesStore } from "@/features/daily-notes/store/dailyNotesStore";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { useVaultStore } from "@/features/vault/store/vaultStore";

type UseAppOrchestrationResult = {
  path: string | null;
  vaultHydrated: boolean;
  settingsHydrated: boolean;
  isValidating: boolean;
  validationError: string | null;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
};

export function useAppOrchestration(): UseAppOrchestrationResult {
  const { path, _hasHydrated, openVault, closeVault, loadVault } =
    useVaultStore();
  const {
    loadSettings,
    _hasHydrated: settingsHydrated,
    settings,
  } = useSettingsStore();
  const { openOrCreateDailyNote } = useDailyNotesStore();

  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasAttemptedAutoOpen = useRef(false);

  useEffect(() => {
    loadSettings();
    loadVault();
  }, [loadSettings, loadVault]);

  useEffect(() => {
    const unlisten = listen("open-settings", () => {
      setSettingsOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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

  return {
    path,
    vaultHydrated: _hasHydrated,
    settingsHydrated,
    isValidating,
    validationError,
    settingsOpen,
    setSettingsOpen,
  };
}
