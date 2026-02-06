import { Save } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { useMeetingNotesStore } from "../../store/meetingNotesStore";

export function SaveSection() {
  const transcript = useMeetingNotesStore((s) => s.transcript);
  const summary = useMeetingNotesStore((s) => s.summary);
  const saveNote = useMeetingNotesStore((s) => s.saveNote);

  const [title, setTitle] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return `회의록-${today}`;
  });
  const [includeTranscript, setIncludeTranscript] = useState(true);

  const canSave = transcript || summary;

  const handleSave = useCallback(() => {
    saveNote(title, includeTranscript);
  }, [saveNote, title, includeTranscript]);

  if (!canSave) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="note-title" className="text-sm font-medium">
          노트 제목
        </Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="회의록 제목"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="include-transcript" className="text-sm">
          전사본 포함
        </Label>
        <Switch
          id="include-transcript"
          checked={includeTranscript}
          onCheckedChange={setIncludeTranscript}
        />
      </div>

      <Button onClick={handleSave} className="w-full">
        <Save className="mr-2 size-4" />
        노트 저장
      </Button>
    </div>
  );
}
