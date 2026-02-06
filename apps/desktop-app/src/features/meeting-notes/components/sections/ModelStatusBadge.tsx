import { CheckCircle, Download, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useMeetingNotesStore } from "../../store/meetingNotesStore";
import { formatFileSize } from "../utils";

export function ModelStatusBadge() {
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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
      <Download className="size-4" />
      <span>모델 미설치 (466MB)</span>
    </div>
  );
}
