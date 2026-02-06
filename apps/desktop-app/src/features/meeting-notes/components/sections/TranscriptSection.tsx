import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useMeetingNotesStore } from "../../store/meetingNotesStore";

export function TranscriptSection() {
  const transcript = useMeetingNotesStore((s) => s.transcript);
  const transcriptionStatus = useMeetingNotesStore(
    (s) => s.transcriptionStatus
  );

  if (transcriptionStatus !== "completed" || !transcript) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">전사본</Label>
      <ScrollArea className="h-40 rounded-md border">
        <div className="p-3 text-sm whitespace-pre-wrap">{transcript}</div>
      </ScrollArea>
    </div>
  );
}
