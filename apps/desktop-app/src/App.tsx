import { VaultPicker } from "@/features/vault/components/VaultPicker";
import { useVaultStore } from "@/features/vault/store/vaultStore";
import { EditorLayout } from "@/layouts/EditorLayout";

function App() {
  const { path } = useVaultStore();

  if (!path) {
    return <VaultPicker />;
  }

  return <EditorLayout />;
}

export default App;
