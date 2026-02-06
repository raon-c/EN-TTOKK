import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { useMeetingNotesStore } from "../../store/meetingNotesStore";

export function SummarySection() {
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
