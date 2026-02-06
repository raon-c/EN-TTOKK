import {
  Circle,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Play,
  Square,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useMeetingNotesStore } from "../../store/meetingNotesStore";
import { formatDuration } from "../utils";

export function RecordingSection() {
  const {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const modelStatus = useMeetingNotesStore((s) => s.modelStatus);
  const recordingStatus = useMeetingNotesStore((s) => s.recordingStatus);
  const recordedFilePath = useMeetingNotesStore((s) => s.recordedFilePath);
  const transcribeRecording = useMeetingNotesStore(
    (s) => s.transcribeRecording
  );
  const cleanupRecording = useMeetingNotesStore((s) => s.cleanupRecording);
  const downloadModel = useMeetingNotesStore((s) => s.downloadModel);
  const isDownloading = useMeetingNotesStore((s) => s.isDownloading);

  const [showModelPrompt, setShowModelPrompt] = useState(false);

  const isModelReady = modelStatus === "ready";

  const handleTranscribe = useCallback(async () => {
    if (!isModelReady) {
      setShowModelPrompt(true);
      return;
    }
    await transcribeRecording();
  }, [isModelReady, transcribeRecording]);

  const handleDownloadAndTranscribe = useCallback(async () => {
    setShowModelPrompt(false);
    await downloadModel();
  }, [downloadModel]);

  const handleClearRecording = useCallback(async () => {
    await cleanupRecording();
    setShowModelPrompt(false);
  }, [cleanupRecording]);

  if (isRecording || recordingStatus === "recording") {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
            <Circle className="size-3 animate-pulse fill-red-500 text-red-500" />
            <span>녹음 중</span>
          </div>
          <span className="font-mono text-lg text-red-700 dark:text-red-400">
            {formatDuration(duration)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={stopRecording}
            className="flex-1"
            variant="destructive"
          >
            <Square className="mr-2 size-4" />
            녹음 중지
          </Button>
          <Button
            onClick={cancelRecording}
            variant="outline"
            className="flex-1"
          >
            <X className="mr-2 size-4" />
            취소
          </Button>
        </div>
      </div>
    );
  }

  if (recordingStatus === "completed" && recordedFilePath) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <FileAudio className="size-4" />
            <span>녹음 완료</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearRecording}
            className="h-6 w-6 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {showModelPrompt ? (
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
        ) : (
          <Button onClick={handleTranscribe} className="w-full">
            <Play className="mr-2 size-4" />
            변환 시작
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={startRecording}
        variant="outline"
        className="w-full"
        disabled={
          recordingStatus === "requesting_permission" ||
          recordingStatus === "stopping"
        }
      >
        {recordingStatus === "requesting_permission" ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            권한 요청 중...
          </>
        ) : (
          <>
            <Mic className="mr-2 size-4" />
            녹음 시작
          </>
        )}
      </Button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
