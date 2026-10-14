import type { AiDisplayStatus } from "@/lib/lab-engine/soc/ai-grading/compose";
import { IconCheck, IconClock, IconCross, IconEye, IconInfo, IconSearch } from "@/components/ui/icons";

/** Status always pairs an icon with a word, so meaning never depends on colour. */
const STATUS: Record<AiDisplayStatus, { label: string; tone: string; Icon: typeof IconCheck }> = {
  pending: { label: "Pending", tone: "border-line text-muted", Icon: IconClock },
  graded: { label: "Graded", tone: "border-success/50 text-success", Icon: IconCheck },
  preview: { label: "Preview", tone: "border-cyan/50 text-cyan", Icon: IconEye },
  not_graded: { label: "Not graded", tone: "border-line text-muted", Icon: IconCross },
  under_review: { label: "Under review", tone: "border-warning/50 text-warning", Icon: IconSearch },
  not_available: { label: "Not available", tone: "border-line text-muted", Icon: IconInfo },
};

export function AiStatusChip({ status }: { status: AiDisplayStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-xs border bg-surface-subtle px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${s.tone}`}>
      <s.Icon className={`h-3 w-3 ${status === "pending" ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
