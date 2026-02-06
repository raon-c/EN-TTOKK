import { open } from "@tauri-apps/plugin-dialog";
import {
  CheckCircle,
  Circle,
  Download,
  FileAudio,
  FolderOpen,
  Loader2,
  Mic,
  Play,
  Radio,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";

import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useRealtimeTranscription } from "../hooks/useRealtimeTranscription";
import { useMeetingNotesStore } from "../store/meetingNotesStore";
import { SUPPORTED_AUDIO_EXTENSIONS } from "../types";

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

function ModelStatusBadge() {
  const modelStatus = useMeetingNotesStore((s) => s.modelStatus);
  const isDownloading = useMeetingNotesStore((s) => s.isDownloading);
  const downloadProgress = useMeetingNotesStore((s) => s.downloadProgress);
  const cancelDownload = useMeetingNotesStore((s) => s.cancelDownload);

  if (modelStatus === "ready") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
        <CheckCircle className="size-4" />
        <span>모델 준비 완료</span>
      </div>
    );
  }

  if (modelStatus === "checking") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>모델 상태 확인 중...</span>
      </div>
    );
  }

  if (isDownloading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>모델 다운로드 중...</span>
          <span>{downloadProgress.toFixed(0)}%</span>
        </div>
        <Progress value={downloadProgress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {formatFileSize((downloadProgress / 100) * 488304832)} / 466 MB
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelDownload}
            className="h-6 px-2 text-xs"
          >
            <X className="mr-1 size-3" />
            취소
          </Button>
        </div>
      </div>
    );
  }

  // 모델 미설치 - 간단한 안내만 표시 (다운로드는 변환 시 안내)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
      <Download className="size-4" />
      <span>모델 미설치 (466MB)</span>
    </div>
  );
}

function RecordingSection() {
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

  // 녹음 중인 경우
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

  // 녹음 완료 후 변환 대기 상태
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

  // 기본 상태: 녹음 버튼
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

function RealtimeTranscriptionSection() {
  const {
    status,
    partialText,
    finalText,
    segments,
    error,
    startStreaming,
    stopStreaming,
  } = useRealtimeTranscription();

  const modelStatus = useMeetingNotesStore((s) => s.modelStatus);
  const downloadModel = useMeetingNotesStore((s) => s.downloadModel);
  const isDownloading = useMeetingNotesStore((s) => s.isDownloading);
  const setTranscript = useMeetingNotesStore((s) => s.setTranscript);

  const [showModelPrompt, setShowModelPrompt] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<number | null>(null);

  const isModelReady = modelStatus === "ready";
  const isStreaming = status === "streaming";

  // Duration timer
  useEffect(() => {
    if (isStreaming) {
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStreaming]);

  const handleStart = useCallback(async () => {
    if (!isModelReady) {
      setShowModelPrompt(true);
      return;
    }
    setDuration(0);
    await startStreaming();
  }, [isModelReady, startStreaming]);

  const handleStop = useCallback(async () => {
    const text = await stopStreaming();
    if (text) {
      setTranscript(text);
    }
  }, [stopStreaming, setTranscript]);

  const handleDownload = useCallback(async () => {
    setShowModelPrompt(false);
    await downloadModel();
  }, [downloadModel]);

  // 실시간 전사 중인 경우
  if (isStreaming || status === "initializing") {
    return (
      <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
            {status === "initializing" ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                <span>모델 로딩 중...</span>
              </>
            ) : (
              <>
                <Radio className="size-3 animate-pulse text-blue-500" />
                <span>실시간 전사 중</span>
              </>
            )}
          </div>
          <span className="font-mono text-lg text-blue-700 dark:text-blue-400">
            {formatDuration(duration)}
          </span>
        </div>

        {/* 실시간 텍스트 표시 */}
        {(partialText || segments.length > 0) && (
          <ScrollArea className="h-32 rounded-md border bg-white/50 dark:bg-black/20">
            <div className="p-3 text-sm">
              {segments.slice(-5).map((segment, i) => (
                <span key={i} className="text-muted-foreground">
                  {segment}{" "}
                </span>
              ))}
              {partialText && (
                <span className="text-blue-600 dark:text-blue-400">
                  {partialText}
                  <span className="animate-pulse">▌</span>
                </span>
              )}
            </div>
          </ScrollArea>
        )}

        <Button
          onClick={handleStop}
          className="w-full"
          variant="destructive"
          disabled={status === "initializing"}
        >
          <Square className="mr-2 size-4" />
          전사 중지
        </Button>
      </div>
    );
  }

  // 전사 완료 후 결과가 있는 경우
  if (finalText) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="size-4 text-green-500" />
            <span>실시간 전사 완료</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setTranscript(null)}
            className="h-6 w-6 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>
        <ScrollArea className="h-24 rounded-md border">
          <div className="p-3 text-sm">{finalText}</div>
        </ScrollArea>
      </div>
    );
  }

  // 기본 상태: 실시간 전사 시작 버튼
  return (
    <div className="space-y-2">
      {showModelPrompt ? (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <div className="text-sm text-amber-700 dark:text-amber-400">
            실시간 전사를 위해 모델 다운로드가 필요합니다 (466MB)
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDownload} disabled={isDownloading}>
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
        <Button
          onClick={handleStart}
          variant="default"
          className="w-full"
          disabled={status === "stopping"}
        >
          <Radio className="mr-2 size-4" />
          실시간 전사 시작
        </Button>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

function RecordingsListSection() {
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

function AudioUploadSection() {
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
    // 다운로드 완료 후 자동으로 변환 시작은 하지 않음 (사용자가 다시 버튼 클릭)
  }, [downloadModel]);

  const handleClearFile = useCallback(() => {
    setSelectedFilePath(null);
    setShowModelPrompt(false);
  }, []);

  // 변환 중인 경우
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

  // 파일이 선택된 경우
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

  // 파일 선택 전
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

function TranscriptSection() {
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

function SummarySection() {
  const transcript = useMeetingNotesStore((s) => s.transcript);
  const summary = useMeetingNotesStore((s) => s.summary);
  const summaryStatus = useMeetingNotesStore((s) => s.summaryStatus);
  const generateSummary = useMeetingNotesStore((s) => s.generateSummary);

  const canGenerate = transcript && summaryStatus !== "generating";

  if (!transcript) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">요약</Label>
        <Button
          size="sm"
          variant="outline"
          onClick={generateSummary}
          disabled={!canGenerate}
        >
          {summaryStatus === "generating" ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              요약 생성
            </>
          )}
        </Button>
      </div>

      {summary && (
        <div className="space-y-3 rounded-lg border p-3 text-sm">
          {summary.keyPoints.length > 0 && (
            <div>
              <div className="mb-1 font-medium">핵심 내용</div>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {summary.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.decisions.length > 0 && (
            <div>
              <div className="mb-1 font-medium">결정 사항</div>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {summary.decisions.map((decision, i) => (
                  <li key={i}>{decision}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.actionItems.length > 0 && (
            <div>
              <div className="mb-1 font-medium">액션 아이템</div>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {summary.actionItems.map((item, i) => (
                  <li key={i}>
                    {item.description}
                    {item.assignee && ` (@${item.assignee})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaveSection() {
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
