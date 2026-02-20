import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useVaultStore } from "../store/vaultStore";

interface VaultPickerProps {
  initialError?: string | null;
}

export function VaultPicker({ initialError = null }: VaultPickerProps) {
  const { openVault } = useVaultStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleOpenVault = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Vault Folder",
      });

      if (selected && typeof selected === "string") {
        await openVault(selected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open vault");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Enttokk</CardTitle>
          <CardDescription>
            Open an existing vault or create a new one to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="default"
            className="w-full"
            onClick={handleOpenVault}
            disabled={isLoading}
          >
            <FolderOpenIcon className="mr-2 size-4" />
            {isLoading ? "Opening..." : "Open Vault"}
          </Button>
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
