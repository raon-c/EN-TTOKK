import { Download, FolderOpen, Loader2, Play, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useMeetingNotesStore } from "../../store/meetingNotesStore";
import { formatFileSize } from "../utils";

export function RecordingsListSection() {
  const recordings = useMeetingNotesStore((s) => s.recordings);
  const isLoadingRecordings = useMeetingNotesStore(
    (s) => s.isLoadingRecordings
  );
  const loadRecordings = useMeetingNotesStore((s) => s.loadRecordings);
  const deleteRecording = useMeetingNotesStore((s) => s.deleteRecording);
  const transcribeAudio = useMeetingNotesStore((s) => s.transcribeAudio);
  const modelStatus = useMeetingNotesStore((s) => s.modelStatus);
  const downloadModel = useMeetingNotesStore((s) => s.downloadModel);
  const isDownloading = useMeetingNotesStore((s) => s.isDownloading);
  const transcriptionStatus = useMeetingNotesStore(
    (s) => s.transcriptionStatus
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelPrompt, setShowModelPrompt] = useState(false);

  const isModelReady = modelStatus === "ready";
  const isTranscribing = transcriptionStatus === "transcribing";

  useEffect(() => {
    if (isExpanded && recordings.length === 0 && !isLoadingRecordings) {
      void loadRecordings();
    }
  }, [isExpanded, recordings.length, isLoadingRecordings, loadRecordings]);

  const handleTranscribe = useCallback(
    async (filePath: string) => {
      if (!isModelReady) {
        setShowModelPrompt(true);
        return;
      }
      await transcribeAudio(filePath);
    },
    [isModelReady, transcribeAudio]
  );

  const handleDownloadAndTranscribe = useCallback(async () => {
    setShowModelPrompt(false);
    await downloadModel();
  }, [downloadModel]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="w-full justify-start text-muted-foreground"
      >
        <FolderOpen className="mr-2 size-4" />
        이전 녹음 파일
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">이전 녹음 파일</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="h-6 px-2"
        >
          <X className="size-4" />
        </Button>
      </div>

      {showModelPrompt && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <div className="text-sm text-amber-700 dark:text-amber-400">
            변환을 위해 모델 다운로드가 필요합니다 (466MB)
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleDownloadAndTranscribe}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  다운로드 중...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  다운로드
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowModelPrompt(false)}
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {isLoadingRecordings ? (
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          불러오는 중...
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          녹음 파일이 없습니다
        </div>
      ) : (
        <ScrollArea className="h-40">
          <div className="space-y-2 pr-3">
            {recordings.map((recording) => (
              <div
                key={recording.file_path}
                className="flex items-center justify-between rounded-lg border p-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs text-muted-foreground">
                    {formatDate(recording.created_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(recording.file_size)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTranscribe(recording.file_path)}
                    disabled={isTranscribing}
                    className="h-7 px-2"
                  >
                    <Play className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRecording(recording.file_path)}
                    className="h-7 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={loadRecordings}
        disabled={isLoadingRecordings}
        className="w-full"
      >
        {isLoadingRecordings ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : null}
        새로고침
      </Button>
    </div>
  );
}
