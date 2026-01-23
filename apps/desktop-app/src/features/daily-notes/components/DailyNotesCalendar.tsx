import * as React from "react";
import { toast } from "sonner";

import { Calendar } from "@/components/ui/calendar";
import { SidebarContent } from "@/components/ui/sidebar";
import { useSettingsStore } from "@/features/settings/store/settingsStore";
import { useVaultStore } from "@/features/vault/store/vaultStore";

import { useDailyNotesStore } from "../store/dailyNotesStore";
import { DEFAULT_DAILY_NOTES_SETTINGS } from "../types";
import { CalendarDayWithDot } from "./CalendarDayWithDot";

export function DailyNotesCalendar() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date()
  );

  const { path: vaultPath } = useVaultStore();
  const { settings } = useSettingsStore();
  const {
    scanDailyNotes,
    openOrCreateDailyNote,
    isScanning,
    error,
    clearError,
  } = useDailyNotesStore();

  // Show error toast when error occurs
  React.useEffect(() => {
    if (error) {
      toast.error("Daily Notes Error", {
        description: error,
      });
      clearError();
    }
  }, [error, clearError]);

  const dailyNotesSettings =
    settings.dailyNotes ?? DEFAULT_DAILY_NOTES_SETTINGS;

  React.useEffect(() => {
    if (vaultPath) {
      scanDailyNotes(dailyNotesSettings);
    }
  }, [vaultPath, dailyNotesSettings, scanDailyNotes]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    openOrCreateDailyNote(date, dailyNotesSettings);
  };

  return (
    <SidebarContent>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        disabled={isScanning}
        className="w-full bg-sidebar"
        components={{
          DayButton: (props) => (
            <CalendarDayWithDot {...props} settings={dailyNotesSettings} />
          ),
        }}
      />
    </SidebarContent>
  );
}
