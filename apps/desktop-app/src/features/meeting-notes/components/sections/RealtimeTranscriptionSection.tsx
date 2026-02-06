import {
  CheckCircle,
  Download,
  Loader2,
  Radio,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useRealtimeTranscription } from "../../hooks/useRealtimeTranscription";
import { useMeetingNotesStore } from "../../store/meetingNotesStore";
import { formatDuration } from "../utils";

export function RealtimeTranscriptionSection() {
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
