"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { AppMode } from "@/lib/research/config";
import type { JobView } from "@/lib/client/useResearchJob";
import { ResearchProgress } from "./ResearchProgress";

export function StatePanel({ view, mode, onCancel, onRetry }: { view: JobView; mode: AppMode; onCancel: () => void; onRetry: () => void }) {
  const active = view.status === "queued" || view.status === "researching" || view.status === "synthesizing" || view.status === "loading";
  if (active) {
    if (view.status === "loading") {
      return (
        <div className="panel p-6 sm:p-8">
          <p className="meta">Loading</p>
          <p className="mt-2 font-serif text-[22px] leading-snug text-ink">Fetching this research from the server.</p>
        </div>
      );
    }
    return (
      <div className="panel p-6 sm:p-8">
        <ResearchProgress view={view} onCancel={onCancel} />
      </div>
    );
  }
  if (view.status === "missing") {
    return (
      <div className="panel p-6 sm:p-8">
        <p className="meta">Not found</p>
        <p className="mt-2 font-serif text-[24px] leading-snug text-ink">This report is not available in this browser.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{view.error ?? "Reports are stored locally in the browser that created them, and sample reports are available to everyone."}</p>
        <div className="mt-5 flex gap-2">
          <Link href="/" className="btn btn-primary btn-sm">
            Start new research
          </Link>
          <Link href="/research/sample-microsoft" className="btn btn-secondary btn-sm">
            Open a sample report
          </Link>
        </div>
      </div>
    );
  }
  const cancelled = view.status === "cancelled";
  return (
    <div className="panel border-down/30 p-6 sm:p-8">
      <p className={`meta ${cancelled ? "" : "text-down"}`}>{cancelled ? "Cancelled" : "Failed"}</p>
      <p className="mt-2 font-serif text-[24px] leading-snug text-ink">{cancelled ? "You stopped waiting for this research." : "This research did not complete."}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{view.error ?? "No further detail was returned."}</p>
      {mode !== "live" && <p className="mt-2 text-[13.5px] text-muted">Live research is off on this deployment, so in-flight jobs cannot be resumed here.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {(view.retryable || cancelled) && mode === "live" && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {cancelled ? "Resume checking" : "Retry"}
          </button>
        )}
        <Link href="/" className="btn btn-secondary btn-sm">
          Ask again
        </Link>
      </div>
    </div>
  );
}
