import { open } from "@tauri-apps/plugin-dialog";
import { Download, FileAudio, Loader2, Play, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useMeetingNotesStore } from "../../store/meetingNotesStore";
import { SUPPORTED_AUDIO_EXTENSIONS } from "../../types";

export function AudioUploadSection() {
  const modelStatus = useMeetingNotesStore((s) => s.modelStatus);
  const transcriptionStatus = useMeetingNotesStore(
    (s) => s.transcriptionStatus
  );
  const transcriptionProgress = useMeetingNotesStore(
    (s) => s.transcriptionProgress
  );
  const audioFileName = useMeetingNotesStore((s) => s.audioFileName);
  const transcribeAudio = useMeetingNotesStore((s) => s.transcribeAudio);
  const cancelTranscription = useMeetingNotesStore(
    (s) => s.cancelTranscription
  );
  const downloadModel = useMeetingNotesStore((s) => s.downloadModel);
  const isDownloading = useMeetingNotesStore((s) => s.isDownloading);

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [showModelPrompt, setShowModelPrompt] = useState(false);

  const isModelReady = modelStatus === "ready";
  const isTranscribing = transcriptionStatus === "transcribing";

  const handleFileSelect = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Audio",
          extensions: [...SUPPORTED_AUDIO_EXTENSIONS],
        },
      ],
    });

    if (selected && typeof selected === "string") {
      setSelectedFilePath(selected);
      setShowModelPrompt(false);
    }
  }, []);

  const handleStartTranscription = useCallback(async () => {
    if (!selectedFilePath) return;

    if (!isModelReady) {
      setShowModelPrompt(true);
      return;
    }

    await transcribeAudio(selectedFilePath);
  }, [selectedFilePath, isModelReady, transcribeAudio]);

  const handleDownloadAndTranscribe = useCallback(async () => {
    setShowModelPrompt(false);
    await downloadModel();
  }, [downloadModel]);

  const handleClearFile = useCallback(() => {
    setSelectedFilePath(null);
    setShowModelPrompt(false);
  }, []);

  if (isTranscribing) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm">
          <FileAudio className="size-4" />
          <span className="truncate">{audioFileName}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>변환 중...</span>
            <span>{transcriptionProgress.toFixed(0)}%</span>
          </div>
          <Progress value={transcriptionProgress} className="h-2" />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={cancelTranscription}
          className="w-full"
        >
          <X className="mr-2 size-4" />
          취소
        </Button>
      </div>
    );
  }

  if (selectedFilePath) {
    const fileName = selectedFilePath.split("/").pop() ?? selectedFilePath;

    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <FileAudio className="size-4" />
            <span className="truncate max-w-[180px]">{fileName}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearFile}
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
          <Button onClick={handleStartTranscription} className="w-full">
            <Play className="mr-2 size-4" />
            변환 시작
          </Button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleFileSelect}
      className="w-full rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Upload className="size-8 text-muted-foreground" />
        <div className="text-sm font-medium">오디오 파일 선택</div>
        <div className="text-xs text-muted-foreground">
          지원 형식: {SUPPORTED_AUDIO_EXTENSIONS.join(", ")}
        </div>
      </div>
    </button>
  );
}
