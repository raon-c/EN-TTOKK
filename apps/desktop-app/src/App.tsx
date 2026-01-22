import { useEffect, useRef, useState } from "react";

import { commands } from "@/bindings";
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

function App() {
  const { path, _hasHydrated, openVault, closeVault } = useVaultStore();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasAttemptedAutoOpen = useRef(false);

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

  if (!_hasHydrated || isValidating) {
    return <LoadingScreen />;
  }

  if (!path || validationError) {
    return <VaultPicker initialError={validationError} />;
  }

  return <EditorLayout />;
}

export default App;
