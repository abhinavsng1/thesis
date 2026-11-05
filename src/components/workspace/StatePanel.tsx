"use client";

import Link from "next/link";
import { RotateCcw, Square } from "lucide-react";
import type { AppMode } from "@/lib/research/config";
import type { JobView } from "@/lib/client/useResearchJob";

const COPY: Record<string, { title: string; body: string }> = {
  loading: { title: "Loading", body: "Fetching this research from the server." },
  queued: { title: "Queued", body: "The research provider has accepted the run and will start shortly." },
  researching: { title: "Researching", body: "The provider is reading filings, releases and transcripts and assembling a cited evidence pack. Quick runs usually take a few minutes; deep runs can take ten or more." },
  synthesizing: { title: "Synthesizing", body: "Research is complete. The evidence pack is being compressed into a structured report with citations attached to each claim." },
};

export function StatePanel({ view, mode, onCancel, onRetry }: { view: JobView; mode: AppMode; onCancel: () => void; onRetry: () => void }) {
  const active = view.status === "queued" || view.status === "researching" || view.status === "synthesizing" || view.status === "loading";
  if (active) {
    const c = COPY[view.status];
    return (
      <div className="panel p-6 sm:p-8">
        <p className="meta">{c.title}</p>
        <p className="mt-2 font-serif text-[24px] leading-snug text-ink">{c.body}</p>
        <p className="mt-4 text-[13.5px] text-muted">
          {view.providerStatus ? `Provider status: ${view.providerStatus}. ` : ""}
          {view.lastPolledAt ? `Last checked ${new Date(view.lastPolledAt).toLocaleTimeString()}. ` : ""}
          This page checks the real job status every few seconds. There is no progress percentage because the provider does not report one.
        </p>
        {view.status !== "loading" && view.status !== "synthesizing" && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Stop waiting
            </button>
            <span className="self-center text-[12.5px] text-muted">The provider does not expose cancellation; stopping here only stops polling.</span>
          </div>
        )}
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
