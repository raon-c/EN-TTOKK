import { Mic } from "lucide-react";
import { useEffect } from "react";

import { Separator } from "@/components/ui/separator";
import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar";

import { useMeetingNotesStore } from "../store/meetingNotesStore";
import { AudioUploadSection } from "./sections/AudioUploadSection";
import { ModelStatusBadge } from "./sections/ModelStatusBadge";
import { RealtimeTranscriptionSection } from "./sections/RealtimeTranscriptionSection";
import { RecordingSection } from "./sections/RecordingSection";
import { RecordingsListSection } from "./sections/RecordingsListSection";
import { SaveSection } from "./sections/SaveSection";
import { SummarySection } from "./sections/SummarySection";
import { TranscriptSection } from "./sections/TranscriptSection";

export function MeetingNotesPanel() {
  const checkModelStatus = useMeetingNotesStore((s) => s.checkModelStatus);
  const setupEventListeners = useMeetingNotesStore(
    (s) => s.setupEventListeners
  );
  const cleanupEventListeners = useMeetingNotesStore(
    (s) => s.cleanupEventListeners
  );
  const error = useMeetingNotesStore((s) => s.error);

  useEffect(() => {
    void checkModelStatus();
    void setupEventListeners();

    return () => {
      cleanupEventListeners();
    };
  }, [checkModelStatus, setupEventListeners, cleanupEventListeners]);

  return (
    <>
      <SidebarHeader className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Mic className="size-4" />
          <span className="text-sm font-semibold">회의록</span>
        </div>
        <div className="text-xs text-muted-foreground">
          오디오를 텍스트로 변환하고 요약합니다
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="space-y-4 p-3">
          <ModelStatusBadge />
          <RealtimeTranscriptionSection />
          <Separator />
          <RecordingSection />
          <RecordingsListSection />
          <Separator />
          <AudioUploadSection />
          <TranscriptSection />
          <SummarySection />
          <SaveSection />

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </SidebarContent>
    </>
  );
}
