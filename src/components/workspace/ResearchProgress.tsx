"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ExternalLink, FileText, ListChecks, Search, Square, StickyNote, TriangleAlert } from "lucide-react";
import type { TraceEntry, TraceStats } from "@/lib/client/history";
import type { JobView, SynthState } from "@/lib/client/useResearchJob";
import { PHASES, groupTrace, hostOf, phaseOf, statusLine, type Group } from "@/lib/client/trace";

/**
 * The in-progress research workspace. Everything shown is derived from
 * observable events (provider trace, job status, streamed synthesis).
 * The layout keeps the current step visible without scrolling: finished
 * groups collapse to one line, only the current group is expanded.
 */

const SECTION_LABEL: Record<string, string> = {
  brief: "Executive brief",
  thesis: "Investment thesis",
  metrics: "Financial evidence table",
  charts: "Charts",
  scenarios: "Scenarios",
  risks: "Risks and counterarguments",
  catalysts: "Catalysts",
  limitations: "Sources and limitations",
};
const SECTION_ORDER = Object.keys(SECTION_LABEL);

function writingLine(s: SynthState | null): string {
  if (!s || s.stage === "fetching") return "Collecting the evidence pack";
  if (s.stage === "evidence") return "Evidence received, starting to write";
  if (s.stage === "validating") return "Checking every citation against its source";
  if (s.stage === "done") return "Report ready";
  const reached = s.sections.filter((k) => SECTION_ORDER.includes(k));
  const current = reached[reached.length - 1];
  return current ? `Writing the ${SECTION_LABEL[current].toLowerCase()}` : "Drafting the report";
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

export function ResearchProgress({ view, onCancel }: { view: JobView; onCancel: () => void }) {
  const phase = phaseOf(view.trace, view.status);
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);
  const active = view.status !== "completed";
  const line = statusLine(view.trace, view.status, view.status === "synthesizing" ? writingLine(view.synth) : undefined);
  const elapsed = useElapsed(view.item?.createdAt, active);
  const groups = useMemo(() => groupTrace(view.trace), [view.trace]);

  return (
    <section aria-live="polite" aria-busy={active}>
      <PhaseRail phaseIndex={phaseIndex} phase={phase} right={`${elapsed} elapsed · ${view.trace.length} steps`} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-serif text-[21px] leading-snug text-ink sm:text-[23px]">
            {active && <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-teal pulse" aria-hidden="true" />}
            <span>{line}</span>
          </p>

          {view.status === "synthesizing" ? <SynthesisChecklist synth={view.synth} /> : <StepGroups groups={groups} live={active} />}

          {active && view.status !== "synthesizing" && (
            <div className="no-print mt-5 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                Stop waiting
              </button>
              <span className="text-[12.5px] text-muted">You can leave this page; the report will be here when you come back.</span>
            </div>
          )}
        </div>

        <SourcesPanel trace={view.trace} stats={view.traceStats} depth={view.item?.depth} processor={view.item?.processor} />
      </div>
    </section>
  );
}

function PhaseRail({ phaseIndex, phase, right }: { phaseIndex: number; phase: string; right: string }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px] font-semibold uppercase tracking-[0.08em]" aria-label="Research phases">
      {PHASES.map((p, i) => {
        const done = i < phaseIndex || phase === "ready";
        const current = i === phaseIndex && phase !== "ready";
        return (
          <li key={p.id} className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${done ? "border-teal bg-teal text-white" : current ? "border-teal text-teal" : "border-rule-strong text-muted"}`} aria-hidden="true">
              {done ? <Check className="h-3 w-3" /> : current ? <span className="h-2 w-2 rounded-full bg-teal pulse" /> : i + 1}
            </span>
            <span className={done || current ? "text-ink" : "text-muted"}>{p.label}</span>
            {i < PHASES.length - 1 && <span className="mx-1 h-px w-5 bg-rule-strong" aria-hidden="true" />}
          </li>
        );
      })}
      <li className="ml-auto normal-case tracking-normal text-muted tabular-nums">{right}</li>
    </ol>
  );
}

/* ---------- step groups (collapsed when finished) ---------- */

const GROUP_ICON: Record<Group["kind"], React.ComponentType<{ className?: string }>> = {
  plan: ListChecks,
  search: Search,
  read: FileText,
  note: StickyNote,
  status: Check,
  error: TriangleAlert,
};

export function StepGroups({ groups, live, defaultExpandAll = false }: { groups: Group[]; live: boolean; defaultExpandAll?: boolean }) {
  const [expandAll, setExpandAll] = useState(defaultExpandAll);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (groups.length === 0) {
    return (
      <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
        {live ? "The agent reports its plan, searches and the documents it reads here as they happen. The first update usually arrives within a minute." : "No live trace was recorded for this run."}
      </p>
    );
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="meta">Steps</p>
        <button type="button" className="text-[12.5px] font-semibold text-teal-deep hover:underline" onClick={() => setExpandAll((v) => !v)}>
          {expandAll ? "Collapse finished steps" : "Show all steps"}
        </button>
      </div>
      <ol className="mt-2 divide-y divide-rule border-y border-rule">
        {groups.map((g, i) => {
          const isCurrent = live && i === groups.length - 1;
          const isOpen = expandAll || isCurrent || open[i] === true;
          const Icon = GROUP_ICON[g.kind];
          const expandable = g.kind === "search" || g.kind === "read" || g.kind === "plan" || g.kind === "note";
          const time = new Date(g.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          return (
            <li key={`${g.at}-${i}`} className="py-2">
              <button
                type="button"
                className={`grid w-full grid-cols-[1.25rem_1fr_auto] items-start gap-x-3 text-left ${expandable ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => expandable && setOpen((o) => ({ ...o, [i]: !isOpen }))}
                aria-expanded={expandable ? isOpen : undefined}
              >
                <span className="mt-[3px]" aria-hidden="true">
                  {isCurrent ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent" /> : <Icon className={`h-4 w-4 ${g.kind === "error" ? "text-down" : "text-teal"}`} />}
                </span>
                <span className={`text-[14.5px] leading-[1.5] ${g.kind === "status" ? "text-muted" : g.kind === "error" ? "text-down" : "text-ink"}`}>{g.summary}</span>
                <span className="flex items-center gap-2 pt-0.5 text-[11.5px] tabular-nums text-muted">
                  {time}
                  {expandable && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />}
                </span>
              </button>
              {isOpen && expandable && <GroupBody g={g} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GroupBody({ g }: { g: Group }) {
  return (
    <div className="ml-8 mt-2 space-y-2 pb-1">
      {(g.kind === "plan" || g.kind === "note") && g.text && <p className="text-[14px] leading-[1.55] text-ink-2">{g.text}</p>}
      {g.kind === "search" && (
        <>
          {g.objectives.map((o, i) => (
            <p key={i} className="text-[14px] leading-[1.5] text-ink-2">
              {o}
            </p>
          ))}
          {g.queries.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Search queries">
              {g.queries.map((q, i) => (
                <li key={i} className="rounded-[6px] border border-rule bg-paper px-2 py-0.5 text-[12.5px] text-ink-2">
                  {q}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {g.kind === "read" && (
        <ul className="space-y-1">
          {g.docs.map((d) => (
            <li key={d.url ?? d.text} className="text-[14px] leading-[1.45]">
              {d.url ? (
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-teal-deep hover:underline">
                  <span className="truncate">{d.text}</span>
                  <span className="shrink-0 text-[12px] text-muted">{d.host}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-ink">{d.text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- sources panel ---------- */

function SourcesPanel({ trace, stats, depth, processor }: { trace: TraceEntry[]; stats: TraceStats | null; depth?: string; processor?: string }) {
  const hosts = useMemo(() => {
    const map = new Map<string, { count: number; url: string }>();
    for (const t of trace) {
      if (t.type !== "extract") continue;
      const u = t.message.match(/^Extract\s*:\s*(https?:\/\/\S+)$/i)?.[1];
      if (!u) continue;
      const h = hostOf(u);
      const cur = map.get(h);
      if (cur) cur.count += 1;
      else map.set(h, { count: 1, url: u });
    }
    for (const u of stats?.sample ?? []) {
      const h = hostOf(u);
      if (!map.has(h)) map.set(h, { count: 0, url: u });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  }, [trace, stats]);

  return (
    <aside className="lg:border-l lg:border-rule lg:pl-8">
      <p className="meta">Sources</p>
      {stats ? (
        <>
          <p className="mt-2 font-serif text-[32px] leading-none text-ink">
            {stats.read.toLocaleString()}
            <span className="ml-1 font-sans text-[14px] text-muted">read</span>
          </p>
          <p className="mt-1 text-[13px] text-muted">of {stats.considered.toLocaleString()} considered</p>
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
      {hosts.length > 0 && (
        <ul className="mt-4 divide-y divide-rule border-t border-rule" aria-label="Sources read, by site">
          {hosts.map(([host, { count, url }]) => (
            <li key={host}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-2 py-1.5 text-[13.5px]" title={url}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-panel text-[10px] font-bold uppercase text-ink-2" aria-hidden="true">
                    {host.charAt(0)}
                  </span>
                  <span className="truncate text-ink group-hover:text-teal-deep group-hover:underline">{host}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 tabular-nums text-muted">
                  {count > 0 ? count : ""}
                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-muted">Counts and progress come from the research provider. Every step is an actual event from the run.</p>
      <p className="mt-2 text-[12px] text-muted">
        {depth === "deep" ? "Deep" : "Quick"} research{processor ? ` · ${processor}` : ""} ·{" "}
        <Link href="/" className="text-teal-deep hover:underline">
          Ask another question
        </Link>
      </p>
    </aside>
  );
}

/* ---------- synthesis checklist ---------- */

function SynthesisChecklist({ synth }: { synth: SynthState | null }) {
  const reached = new Set(synth?.sections ?? []);
  const stage = synth?.stage ?? "fetching";
  const nextKey = SECTION_ORDER.find((k) => !reached.has(k));
  const spinner = <span className="block h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent" aria-hidden="true" />;
  const empty = <span className="block h-4 w-4 rounded-full border border-rule-strong" aria-hidden="true" />;
  const tick = <Check className="h-4 w-4 text-teal" aria-hidden="true" />;
  return (
    <div className="mt-4">
      <p className="meta">Writing the report</p>
      <ul className="mt-2 divide-y divide-rule border-y border-rule text-[14.5px]">
        <li className="flex items-center justify-between py-2">
          <span className="flex items-center gap-2 text-ink">
            {stage === "fetching" ? spinner : tick}
            Evidence pack received
          </span>
          <span className="text-[12.5px] text-muted">
            {stage === "fetching" ? "" : `${synth?.sources ?? 0} sources${synth?.facts !== undefined ? ` · ${synth.facts} facts · ${synth.metrics} metric rows` : ""}`}
          </span>
        </li>
        {SECTION_ORDER.map((key) => {
          const done = reached.has(key) && stage !== "evidence";
          const writing = !done && stage === "drafting" && key === nextKey;
          return (
            <li key={key} className="flex items-center justify-between py-2">
              <span className={`flex items-center gap-2 ${done || writing ? "text-ink" : "text-muted"}`}>
                {done ? tick : writing ? spinner : empty}
                {SECTION_LABEL[key]}
              </span>
              <span className="text-[12.5px] text-muted">{done ? "drafted" : writing ? "writing" : ""}</span>
            </li>
          );
        })}
        <li className="flex items-center justify-between py-2">
          <span className={`flex items-center gap-2 ${stage === "validating" || stage === "done" ? "text-ink" : "text-muted"}`}>
            {stage === "done" ? tick : stage === "validating" ? spinner : empty}
            Citations checked against sources
          </span>
        </li>
      </ul>
      <p className="mt-3 text-[12.5px] text-muted">
        {synth?.outputTokensEstimate ? `About ${synth.outputTokensEstimate.toLocaleString()} tokens written so far (estimate from streamed text; the exact count appears in the report footer).` : "Written in one pass from the evidence pack; sections tick as the model reaches them."}
        {synth?.attempt && synth.attempt > 1 ? " Second attempt after a validation retry." : ""}
        {synth?.truncated ? " The evidence was trimmed to fit the context budget; the report will say so." : ""}
      </p>
    </div>
  );
}
