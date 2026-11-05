"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Square } from "lucide-react";
import type { TraceEntry } from "@/lib/client/history";
import type { JobView, SynthState } from "@/lib/client/useResearchJob";

/**
 * The in-progress research workspace. Everything shown is derived from
 * observable events: the provider's live trace (plan, searches, documents
 * read, counts, its own progress meter), the job status, and the streamed
 * synthesis progress. Nothing is simulated.
 */

type Phase = "plan" | "search" | "read" | "write" | "ready";
const PHASES: Array<{ id: Phase; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "search", label: "Search" },
  { id: "read", label: "Read" },
  { id: "write", label: "Write" },
  { id: "ready", label: "Ready" },
];

const SECTION_LABEL: Record<string, string> = {
  title: "Title and stance",
  stance: "Title and stance",
  brief: "Executive brief",
  thesis: "Investment thesis",
  metrics: "Financial evidence table",
  charts: "Charts",
  scenarios: "Scenarios",
  risks: "Risks and counterarguments",
  catalysts: "Catalysts",
  limitations: "Sources and limitations",
};
const SECTION_ORDER = ["brief", "thesis", "metrics", "charts", "scenarios", "risks", "catalysts", "limitations"];

/* ---------- humanising the provider trace ---------- */

export interface Step {
  kind: "plan" | "objective" | "query" | "read" | "found" | "tool" | "status" | "error";
  text: string;
  url?: string;
  host?: string;
  at: string;
}

export function humanise(t: TraceEntry): Step {
  const m = t.message.trim();
  if (t.type === "search") {
    const q = m.match(/^Query\s*:\s*(.*)$/i);
    if (q) return { kind: "query", text: q[1], at: t.at };
    const o = m.match(/^Objective\s*:\s*(.*)$/i);
    if (o) return { kind: "objective", text: o[1].replace(/^Find\b/, "Looking for"), at: t.at };
    return { kind: "objective", text: m, at: t.at };
  }
  if (t.type === "extract") {
    const u = m.match(/^Extract\s*:\s*(https?:\/\/\S+)$/i)?.[1];
    if (u) {
      try {
        const url = new URL(u);
        const host = url.hostname.replace(/^www\./, "");
        const file = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
        return { kind: "read", text: file ? describeDocument(file, host) : host, url: u, host, at: t.at };
      } catch {
        return { kind: "read", text: u, url: u, at: t.at };
      }
    }
    return { kind: "read", text: m, at: t.at };
  }
  if (t.type === "tool_call") return { kind: "tool", text: /listing tools/i.test(m) ? "Preparing research tools" : m, at: t.at };
  if (t.type === "exec_status" || t.type === "status") return { kind: "status", text: m, at: t.at };
  if (t.type === "result") return { kind: "found", text: m, at: t.at };
  if (t.type === "error") return { kind: "error", text: m, at: t.at };
  return { kind: "plan", text: m, at: t.at };
}

/** Turns "tsla-20260930.htm" into "10-Q style filing, period ending Sep 2026" where the pattern is recognisable; otherwise the file name. */
function describeDocument(file: string, host: string): string {
  const sec = file.match(/^([a-z]{1,6})-(\d{4})(\d{2})(\d{2})/i);
  if (sec) {
    const month = new Date(Number(sec[2]), Number(sec[3]) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${sec[1].toUpperCase()} filing for the period ending ${month} ${sec[2]} (${host})`;
  }
  if (/\.pdf$/i.test(file)) return `${file.replace(/[-_]+/g, " ").replace(/\.pdf$/i, "")} (PDF, ${host})`;
  if (/press-release|earnings/i.test(file) || /press-release|earnings/i.test(host)) return `Earnings release (${host})`;
  return `${host} · ${file.slice(0, 60)}`;
}

/** Groups the flat trace into readable blocks: an objective followed by its queries, runs of documents read, etc. */
export interface Block {
  kind: "plan" | "search" | "read" | "found" | "status" | "error";
  at: string;
  text?: string;
  queries?: string[];
  docs?: Step[];
}

export function groupSteps(trace: TraceEntry[]): Block[] {
  const blocks: Block[] = [];
  for (const t of trace) {
    const s = humanise(t);
    const last = blocks[blocks.length - 1];
    if (s.kind === "query") {
      if (last?.kind === "search") (last.queries ??= []).push(s.text);
      else blocks.push({ kind: "search", at: s.at, text: undefined, queries: [s.text] });
      continue;
    }
    if (s.kind === "objective") {
      blocks.push({ kind: "search", at: s.at, text: s.text, queries: [] });
      continue;
    }
    if (s.kind === "read") {
      if (last?.kind === "read") {
        if (!last.docs!.some((d) => d.url === s.url)) last.docs!.push(s);
      } else blocks.push({ kind: "read", at: s.at, docs: [s] });
      continue;
    }
    if (s.kind === "tool") {
      blocks.push({ kind: "status", at: s.at, text: s.text });
      continue;
    }
    blocks.push({ kind: s.kind, at: s.at, text: s.text });
  }
  return blocks;
}

function phaseOf(view: JobView): Phase {
  if (view.status === "completed") return "ready";
  if (view.status === "synthesizing") return "write";
  const last = view.trace[view.trace.length - 1];
  if (!last) return "plan";
  if (last.type === "extract" || last.type === "result") return "read";
  if (last.type === "search") return "search";
  return "plan";
}

function headlineOf(view: JobView): string {
  if (view.status === "queued") return "Waiting for the research agent to start";
  if (view.status === "synthesizing") {
    const s = view.synth;
    if (!s || s.stage === "fetching") return "Collecting the evidence pack";
    if (s.stage === "evidence") return "Evidence received. Starting to write";
    if (s.stage === "validating") return "Checking every citation against its source";
    if (s.stage === "done") return "Report ready";
    const reached = s.sections.filter((k) => SECTION_ORDER.includes(k));
    const current = reached[reached.length - 1];
    return current ? `Writing the ${SECTION_LABEL[current].toLowerCase()}` : "Drafting the report";
  }
  const last = view.trace[view.trace.length - 1];
  if (!last) return "Starting research";
  const s = humanise(last);
  switch (s.kind) {
    case "query":
      return `Searching for “${s.text}”`;
    case "objective":
      return s.text;
    case "read":
      return `Reading ${s.text}`;
    case "found":
      return s.text;
    case "plan":
      return firstSentence(s.text);
    default:
      return s.text;
  }
}

function firstSentence(t: string): string {
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : t).slice(0, 160);
}

function useElapsed(since: string | undefined, running: boolean): string {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const update = () => setNowMs(Date.now());
    const t = setInterval(update, 1000);
    const first = setTimeout(update, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [running]);
  if (!since || nowMs === null) return "0:00";
  const sec = Math.max(0, Math.floor((nowMs - new Date(since).getTime()) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/* ---------- component ---------- */

export function ResearchProgress({ view, onCancel }: { view: JobView; onCancel: () => void }) {
  const phase = phaseOf(view);
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);
  const headline = headlineOf(view);
  const blocks = useMemo(() => groupSteps(view.trace), [view.trace]);
  const active = view.status !== "completed";
  const elapsed = useElapsed(view.item?.createdAt, active);
  const stats = view.traceStats;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [blocks.length]);

  const hostCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of view.trace) {
      const s = humanise(t);
      if (s.kind === "read" && s.host) counts.set(s.host, (counts.get(s.host) ?? 0) + 1);
    }
    for (const u of stats?.sample ?? []) {
      try {
        const h = new URL(u).hostname.replace(/^www\./, "");
        if (!counts.has(h)) counts.set(h, 0);
      } catch {
        /* skip */
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [view.trace, stats]);

  return (
    <section aria-live="polite" aria-busy={active}>
      {/* Phase rail */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[12.5px] font-semibold uppercase tracking-[0.08em]" aria-label="Research phases">
        {PHASES.map((p, i) => {
          const done = i < phaseIndex || (phase === "ready" && i <= phaseIndex);
          const current = i === phaseIndex && phase !== "ready";
          return (
            <li key={p.id} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  done ? "border-teal bg-teal text-white" : current ? "border-teal text-teal" : "border-rule-strong text-muted"
                }`}
                aria-hidden="true"
              >
                {done ? <Check className="h-3 w-3" /> : current ? <span className="h-2 w-2 rounded-full bg-teal pulse" /> : i + 1}
              </span>
              <span className={done || current ? "text-ink" : "text-muted"}>{p.label}</span>
              {i < PHASES.length - 1 && <span className="mx-1 h-px w-6 bg-rule-strong" aria-hidden="true" />}
            </li>
          );
        })}
        <li className="ml-auto flex items-center gap-3 normal-case tracking-normal text-muted">
          <span className="tabular-nums">{elapsed} elapsed</span>
          <span aria-hidden="true">·</span>
          <span>{view.trace.length} steps</span>
        </li>
      </ol>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
        {/* Main column */}
        <div className="min-w-0">
          <p className="meta">{view.status === "synthesizing" ? "Writing" : view.status === "queued" ? "Queued" : "Researching"}</p>
          <h2 className="h2 mt-1 text-[26px] text-ink sm:text-[30px]">
            <span className={active ? "" : ""}>{headline}</span>
            {active && <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-teal align-middle pulse" aria-hidden="true" />}
          </h2>

          {view.status === "synthesizing" && view.synth ? (
            <SynthesisChecklist synth={view.synth} />
          ) : (
            <Timeline blocks={blocks} live={active} />
          )}
          <div ref={endRef} />

          {active && view.status !== "synthesizing" && (
            <div className="no-print mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                Stop waiting
              </button>
              <span className="text-[12.5px] text-muted">You can leave this page; the run continues and the report will be here when you return.</span>
            </div>
          )}
        </div>

        {/* Sources panel */}
        <aside className="lg:border-l lg:border-rule lg:pl-8">
          <p className="meta">Sources</p>
          {stats ? (
            <>
              <p className="mt-2 font-serif text-[34px] leading-none text-ink">
                {stats.read.toLocaleString()}
                <span className="ml-1 text-[15px] font-sans text-muted">read</span>
              </p>
              <p className="mt-1 text-[13.5px] text-muted">of {stats.considered.toLocaleString()} considered</p>
              {stats.progress !== null && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[12px] text-muted">
                    <span>Provider progress</span>
                    <span className="tabular-nums text-ink">{Math.round(stats.progress)}%</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.progress)} aria-label="Provider-reported progress">
                    <div className="h-full rounded-full bg-teal transition-[width] duration-700" style={{ width: `${stats.progress}%` }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-[13.5px] text-muted">Source counts appear once the agent starts reading.</p>
          )}
          {hostCounts.length > 0 && (
            <ul className="mt-4 divide-y divide-rule border-t border-rule">
              {hostCounts.map(([host, n]) => (
                <li key={host} className="flex items-center justify-between gap-2 py-1.5 text-[13.5px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-panel text-[10px] font-bold uppercase text-ink-2" aria-hidden="true">
                      {host.charAt(0)}
                    </span>
                    <span className="truncate text-ink">{host}</span>
                  </span>
                  {n > 0 && <span className="shrink-0 tabular-nums text-muted">{n}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            Counts and progress are reported by the research provider. Every step above is an actual event from the run.
          </p>
          {view.item && (
            <p className="mt-3 text-[12px] text-muted">
              {view.item.depth === "deep" ? "Deep" : "Quick"} research{view.item.processor ? ` · ${view.item.processor}` : ""}
              {" · "}
              <Link href="/" className="text-teal-deep hover:underline">
                Ask another question
              </Link>
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

/* ---------- timeline ---------- */

export function Timeline({ blocks, live }: { blocks: Block[]; live: boolean }) {
  if (blocks.length === 0) {
    return (
      <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
        {live ? "The agent will report its plan, searches and the documents it reads here as they happen. The first update usually arrives within a minute." : "No live trace was recorded for this run."}
      </p>
    );
  }
  return (
    <ol className="mt-5 space-y-5">
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        const time = new Date(b.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        return (
          <li key={`${b.at}-${i}`} className="grid grid-cols-[4.25rem_1fr] gap-x-3">
            <time dateTime={b.at} className="pt-0.5 text-[12px] tabular-nums text-muted">
              {time}
            </time>
            <div className={`min-w-0 border-l-2 pl-4 ${isLast && live ? "border-teal" : "border-rule"}`}>
              {b.kind === "plan" && <p className="font-serif text-[17px] leading-[1.5] text-ink">{b.text}</p>}
              {b.kind === "status" && <p className="text-[14px] text-muted">{b.text}</p>}
              {b.kind === "error" && <p className="text-[14px] text-down">{b.text}</p>}
              {b.kind === "found" && <p className="text-[14.5px] leading-[1.5] text-ink">{b.text}</p>}
              {b.kind === "search" && (
                <div>
                  {b.text && <p className="text-[15px] leading-[1.5] text-ink">{b.text}</p>}
                  {b.queries && b.queries.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Search queries">
                      {b.queries.map((q, qi) => (
                        <li key={qi} className="rounded-[6px] border border-rule bg-paper px-2 py-0.5 text-[12.5px] text-ink-2">
                          {q}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {b.kind === "read" && (
                <div>
                  <p className="meta mb-1">Reading {b.docs!.length === 1 ? "a document" : `${b.docs!.length} documents`}</p>
                  <ul className="space-y-1">
                    {b.docs!.map((d) => (
                      <li key={d.url ?? d.text} className="text-[14px] leading-[1.45] text-ink">
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="hover:text-teal-deep hover:underline">
                            {d.text}
                            <ExternalLink className="ml-1 inline h-3 w-3 text-muted" aria-hidden="true" />
                          </a>
                        ) : (
                          d.text
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- synthesis checklist ---------- */

function SynthesisChecklist({ synth }: { synth: SynthState }) {
  const reached = new Set(synth.sections);
  return (
    <div className="mt-5">
      <ul className="divide-y divide-rule border-y border-rule text-[14.5px]">
        <li className="flex items-center justify-between py-2.5">
          <span className="text-ink">Evidence pack received</span>
          <span className="text-muted">
            {synth.stage === "fetching" ? "…" : `${synth.sources ?? 0} sources${synth.facts !== undefined ? ` · ${synth.facts} facts · ${synth.metrics} metric rows` : ""}`}
          </span>
        </li>
        {SECTION_ORDER.map((key) => {
          const done = reached.has(key) && synth.stage !== "evidence";
          const next = !done && synth.stage === "drafting" && SECTION_ORDER.findIndex((k) => !reached.has(k)) === SECTION_ORDER.indexOf(key);
          return (
            <li key={key} className="flex items-center justify-between py-2.5">
              <span className={`flex items-center gap-2 ${done ? "text-ink" : next ? "text-ink" : "text-muted"}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${done ? "border-teal bg-teal text-white" : next ? "border-teal" : "border-rule-strong"}`} aria-hidden="true">
                  {done ? <Check className="h-2.5 w-2.5" /> : next ? <span className="h-1.5 w-1.5 rounded-full bg-teal pulse" /> : null}
                </span>
                {SECTION_LABEL[key]}
              </span>
              <span className="text-[12.5px] text-muted">{done ? "drafted" : next ? "writing" : ""}</span>
            </li>
          );
        })}
        <li className="flex items-center justify-between py-2.5">
          <span className={synth.stage === "validating" || synth.stage === "done" ? "text-ink" : "text-muted"}>Citations checked against sources</span>
          <span className="text-[12.5px] text-muted">{synth.stage === "done" ? "done" : synth.stage === "validating" ? "checking" : ""}</span>
        </li>
      </ul>
      <p className="mt-3 text-[12.5px] text-muted">
        {synth.outputTokensEstimate ? `About ${synth.outputTokensEstimate.toLocaleString()} tokens written so far (estimate from streamed text; the exact count appears in the report footer).` : "The report is written in one pass from the evidence pack; sections tick as the model reaches them."}
        {synth.attempt && synth.attempt > 1 ? " Second attempt after a validation retry." : ""}
        {synth.truncated ? " The evidence was trimmed to fit the context budget; the report will say so." : ""}
      </p>
    </div>
  );
}
