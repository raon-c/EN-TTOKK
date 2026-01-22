import { Monitor, Moon, Sun } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, setTheme } = useSettingsStore();

  const handleThemeChange = (value: string) => {
    setTheme(value as Theme);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your application preferences.
          </DialogDescription>
        </DialogHeader>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
