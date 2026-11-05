"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import type { PublicConfig } from "@/lib/research/config";
import { HORIZON_LABELS, ResearchRequestSchema, type Depth, type Horizon } from "@/lib/schema/request";
import { ApiError, createResearch } from "@/lib/client/api";
import { rememberNewJob } from "@/lib/client/useResearchJob";
import { storageAvailable } from "@/lib/client/history";

const EXAMPLES = [
  "What is the investment thesis for Microsoft over the next three years?",
  "Compare Nvidia and AMD on growth, valuation, and execution risk.",
  "What could invalidate the bull case for Tesla?",
];

export function Composer({ config, draft, onDraftChange }: { config: PublicConfig; draft: string; onDraftChange: (v: string) => void }) {
  const router = useRouter();
  const [depth, setDepth] = useState<Depth>("quick");
  const [horizon, setHorizon] = useState<Horizon | "">("");
  const [budget, setBudget] = useState<number>(1000);
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const idBase = useId();
  const live = config.mode === "live";

  const applyExample = (q: string) => {
    onDraftChange(q);
    setError(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const len = q.length;
      textareaRef.current?.setSelectionRange(len, len);
    });
  };

  const submit = async () => {
    if (submitting) return;
    setError(null);
    const parsed = ResearchRequestSchema.safeParse({ question: draft, depth, horizon: horizon || undefined, budgetWords: budget });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the question.");
      return;
    }
    if (!live) {
      setError("Live research is off on this deployment. Open a sample report, or configure PARALLEL_API_KEY and ANTHROPIC_API_KEY to run real research.");
      return;
    }
    setSubmitting(true);
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    try {
      const job = await createResearch(parsed.data, keyRef.current);
      const saved = rememberNewJob({
        id: job.id,
        question: parsed.data.question,
        depth: parsed.data.depth,
        horizon: parsed.data.horizon,
        budgetWords: parsed.data.budgetWords,
        status: "queued",
        createdAt: job.createdAt,
        updatedAt: new Date().toISOString(),
        processor: job.processor,
        events: [{ at: new Date().toISOString(), type: "job.created", message: `Research run created with the ${job.processor} processor (${parsed.data.depth} depth).`, detail: { processor: job.processor, depth: parsed.data.depth, reused: job.reused } }],
      });
      if (!saved && !storageAvailable()) {
        // Still navigate: the hook keeps an in-memory copy for this tab.
      }
      keyRef.current = "";
      router.push(`/research/${encodeURIComponent(job.id)}`);
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError("Could not start research.", 0, true);
      setError(e.message);
      if (!e.retryable && e.status !== 503) keyRef.current = "";
      setSubmitting(false);
    }
  };

  return (
    <div className="panel p-4 sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        aria-describedby={error ? `${idBase}-error` : undefined}
      >
        <label htmlFor={`${idBase}-q`} className="meta block">
          Research question
        </label>
        <textarea
          id={`${idBase}-q`}
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          maxLength={600}
          placeholder="What is the investment thesis for Microsoft over the next three years?"
          className="mt-2 w-full resize-y rounded-[9px] border border-rule bg-paper px-3.5 py-3 font-serif text-[20px] leading-[1.35] text-ink placeholder:text-muted/60 focus:border-teal focus:outline-none sm:text-[22px]"
          aria-invalid={error ? true : undefined}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Research depth</legend>
            <span className="meta">Depth</span>
            <div className="seg" role="radiogroup" aria-label="Research depth">
              {(["quick", "deep"] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={depth === d} onClick={() => setDepth(d)}>
                  {d === "quick" ? "Quick" : "Deep"}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-2">
            <label htmlFor={`${idBase}-h`} className="meta">
              Horizon
            </label>
            <select
              id={`${idBase}-h`}
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon | "")}
              className="rounded-[9px] border border-rule-strong bg-paper px-2.5 py-1.5 text-[13.5px] font-semibold text-ink-2 focus:border-teal focus:outline-none"
            >
              <option value="">Not specified</option>
              {(Object.keys(HORIZON_LABELS) as Horizon[]).map((h) => (
                <option key={h} value={h}>
                  {HORIZON_LABELS[h]}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
            {showMore ? "Fewer options" : "Report length"}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12.5px] text-muted sm:inline">⌘↵ to submit</span>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
              {submitting ? "Starting…" : "Start research"}
            </button>
          </div>
        </div>
        {showMore && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule pt-3">
            <label htmlFor={`${idBase}-b`} className="meta">
              Full report length
            </label>
            <input
              id={`${idBase}-b`}
              type="range"
              min={400}
              max={2000}
              step={100}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-44 accent-[var(--teal)]"
              aria-valuetext={`${budget} words`}
            />
            <span className="text-[13.5px] text-ink-2">About {budget.toLocaleString()} words</span>
            <span className="text-[12.5px] text-muted">The brief stays short regardless.</span>
          </div>
        )}
        {error && (
          <p id={`${idBase}-error`} role="alert" className="mt-3 rounded-[9px] border border-down/30 bg-down-soft px-3 py-2 text-[14px] text-[#7a2c24]">
            {error}
          </p>
        )}
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3.5">
        <span className="meta mr-1">Try</span>
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => applyExample(q)}
            className="rounded-full border border-rule-strong bg-paper px-3 py-1.5 text-left text-[13.5px] leading-snug text-ink-2 transition-colors hover:border-teal hover:bg-teal-tint hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
