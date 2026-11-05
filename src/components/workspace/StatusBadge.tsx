import type { JobStatus } from "@/lib/schema/request";

const LABEL: Record<JobStatus | "loading" | "missing", string> = {
  queued: "Queued",
  researching: "Researching",
  synthesizing: "Synthesizing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  loading: "Loading",
  missing: "Not found",
};

export function StatusBadge({ status, compact = false }: { status: JobStatus | "loading" | "missing"; compact?: boolean }) {
  const active = status === "queued" || status === "researching" || status === "synthesizing" || status === "loading";
  const tone =
    status === "completed" ? "bg-teal" : status === "failed" ? "bg-down" : status === "cancelled" || status === "missing" ? "bg-muted" : "bg-gold";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-ink-2 ${compact ? "text-[12px]" : "text-[13px]"}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${tone} ${active ? "pulse" : ""}`} aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
