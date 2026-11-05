"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/schema/report";
import type { ActivityEvent, JobStatus } from "@/lib/schema/request";
import { ApiError, fetchReport, fetchReportStream, fetchStatus, type ReportProgressEvent } from "./api";
import { getHistoryItem, patchHistory, upsertHistory, type HistoryItem, type TraceEntry, type TraceStats } from "./history";

/**
 * Drives one research job from the browser: polls status, triggers synthesis
 * when the provider finishes, persists the result locally, and exposes
 * observable state. Nothing here invents progress; every state transition
 * corresponds to a server response.
 */

export interface JobView {
  id: string;
  status: JobStatus | "loading" | "missing";
  providerStatus?: string;
  item: HistoryItem | null;
  report: Report | null;
  error: string | null;
  retryable: boolean;
  events: ActivityEvent[];
  lastPolledAt: string | null;
  cancelled: boolean;
  /** Live provider trace: what the research agent is doing right now. */
  trace: TraceEntry[];
  traceStats: TraceStats | null;
  streamState: "idle" | "open" | "reconnecting" | "closed";
  /** Observable progress of report synthesis (streamed from the server). */
  synth: SynthState | null;
}

export interface SynthState {
  startedAt: string;
  sources?: number;
  facts?: number;
  metrics?: number;
  truncated?: boolean;
  attempt?: number;
  outputTokensEstimate?: number;
  sections: string[];
  stage: "fetching" | "evidence" | "drafting" | "validating" | "done";
}

const TRACE_MAX = 300;

const POLL_FAST_MS = 4000;
const POLL_SLOW_MS = 8000;
const SLOW_AFTER_MS = 2 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

export function useResearchJob(id: string) {
  const isSample = id.startsWith("sample-");
  const [view, setView] = useState<JobView>({ id, status: "loading", item: null, report: null, error: null, retryable: false, events: [], lastPolledAt: null, cancelled: false, trace: [], traceStats: null, streamState: "idle", synth: null });
  const source = useRef<EventSource | null>(null);
  const openStreamRef = useRef<() => void>(() => {});
  const seen = useRef<Set<string>>(new Set());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const startedAt = useRef<number>(0);
  const pollRef = useRef<(item: HistoryItem) => Promise<void>>(async () => {});
  const stopped = useRef(false);
  const lastProviderStatus = useRef<string | undefined>(undefined);

  const pushEvent = useCallback((e: Omit<ActivityEvent, "at">) => {
    const ev: ActivityEvent = { at: now(), ...e };
    setView((v) => {
      const events = [...v.events, ev];
      if (!isSample) patchHistory(id, { events });
      return { ...v, events };
    });
  }, [id, isSample]);

  const persistTraceSoon = useCallback(() => {
    if (persistTimer.current) return;
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      setView((v) => {
        patchHistory(id, { trace: v.trace, traceStats: v.traceStats ?? undefined });
        return v;
      });
    }, 1500);
  }, [id]);

  const closeStream = useCallback(() => {
    source.current?.close();
    source.current = null;
    setView((v) => (v.streamState === "closed" ? v : { ...v, streamState: "closed" }));
  }, []);

  /** Opens the live provider trace. The browser's EventSource reconnects on its own; the provider replays messages, so entries are deduplicated. */
  const openStream = useCallback(() => {
    if (source.current || typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/research/${encodeURIComponent(id)}/events`);
    source.current = es;
    setView((v) => ({ ...v, streamState: "open" }));
    const push = (entry: TraceEntry) => {
      const key = `${entry.type}|${entry.at}|${entry.message}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      setView((v) => ({ ...v, trace: [...v.trace, entry].slice(-TRACE_MAX) }));
      persistTraceSoon();
    };
    for (const type of ["plan", "search", "result", "tool_call", "exec_status", "extract"] as const) {
      es.addEventListener(type, (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data) as { message?: string; timestamp?: string };
          if (d.message) push({ at: d.timestamp ?? now(), type, message: d.message });
        } catch {
          /* ignore malformed */
        }
      });
    }
    es.addEventListener("stats", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { stats?: Omit<TraceStats, "at"> };
        if (d.stats) {
          setView((v) => ({ ...v, traceStats: { ...d.stats!, at: now() } }));
          persistTraceSoon();
        }
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("error", (e) => {
      // Provider-reported error event (not a connection error): surface it in the trace.
      if (e instanceof MessageEvent && typeof e.data === "string") {
        try {
          const d = JSON.parse(e.data) as { message?: string };
          if (d.message) push({ at: now(), type: "error", message: d.message });
        } catch {
          /* ignore */
        }
      }
    });
    es.addEventListener("end", () => {
      // Upstream closed (run finished or 570 s budget). Reconnect only while the job is still active.
      es.close();
      source.current = null;
      setView((v) => {
        if (v.status === "queued" || v.status === "researching") {
          setTimeout(() => openStreamRef.current(), 2000);
          return { ...v, streamState: "reconnecting" };
        }
        return { ...v, streamState: "closed" };
      });
    });
    es.onerror = () => setView((v) => (v.streamState === "closed" ? v : { ...v, streamState: "reconnecting" }));
  }, [id, persistTraceSoon]);

  const stopPolling = useCallback(() => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    abort.current?.abort();
    closeStream();
  }, [closeStream]);

  const synthesize = useCallback(async (item: HistoryItem) => {
    closeStream();
    setView((v) => {
      patchHistory(id, { trace: v.trace, traceStats: v.traceStats ?? undefined });
      return { ...v, status: "synthesizing", error: null };
    });
    patchHistory(id, { status: "synthesizing" });
    pushEvent({ type: "synthesis.started", message: "Research complete. Synthesizing the report from the evidence pack." });
    setView((v) => ({ ...v, synth: { startedAt: now(), sections: [], stage: "fetching" } }));
    try {
      const ctrl = new AbortController();
      abort.current = ctrl;
      const onProgress = (p: ReportProgressEvent) =>
        setView((v) => {
          const base: SynthState = v.synth ?? { startedAt: now(), sections: [], stage: "fetching" };
          switch (p.stage) {
            case "result":
              return { ...v, synth: { ...base, stage: "evidence", sources: p.sources } };
            case "evidence":
              return { ...v, synth: { ...base, stage: "evidence", sources: p.sources, facts: p.facts, metrics: p.metrics, truncated: p.truncated } };
            case "drafting":
              return { ...v, synth: { ...base, stage: "drafting", attempt: p.attempt, outputTokensEstimate: p.outputTokensEstimate, sections: p.sections } };
            case "validating":
              return { ...v, synth: { ...base, stage: "validating" } };
            case "done":
              return { ...v, synth: { ...base, stage: "done" } };
          }
        });
      const { report } = await fetchReportStream(id, { question: item.question, depth: item.depth, horizon: item.horizon, budgetWords: item.budgetWords }, onProgress, ctrl.signal);
      const detail: ActivityEvent["detail"] = {
        sources: report.sources.length,
        charts: report.charts.length,
        words: report.stats.wordCount,
        model: report.usage?.synthesis?.model ?? null,
        inputTokens: report.usage?.synthesis?.inputTokens ?? null,
        outputTokens: report.usage?.synthesis?.outputTokens ?? null,
      };
      const next = patchHistory(id, { status: "completed", report, title: report.title });
      setView((v) => ({ ...v, status: "completed", report, item: next ?? v.item, error: null }));
      pushEvent({ type: "synthesis.completed", message: `Report ready: ${report.sources.length} sources, ${report.charts.length} charts, ${report.stats.wordCount} words.`, detail });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const e = err instanceof ApiError ? err : new ApiError("Synthesis failed.", 500, true);
      patchHistory(id, { status: "failed", error: e.message });
      setView((v) => ({ ...v, status: "failed", error: e.message, retryable: e.retryable }));
      pushEvent({ type: "synthesis.failed", message: e.message });
    }
  }, [id, pushEvent, closeStream]);

  const poll = useCallback(async (item: HistoryItem) => {
    if (stopped.current) return;
    if (!source.current) openStream();
    try {
      const ctrl = new AbortController();
      abort.current = ctrl;
      const s = await fetchStatus(id, ctrl.signal);
      if (stopped.current) return;
      setView((v) => ({ ...v, lastPolledAt: now(), providerStatus: s.providerStatus }));
      if (s.providerStatus && s.providerStatus !== lastProviderStatus.current) {
        lastProviderStatus.current = s.providerStatus;
        pushEvent({ type: "provider.status", message: `Provider status: ${s.providerStatus}.`, detail: { providerStatus: s.providerStatus } });
      }
      if (s.status === "completed") {
        await synthesize(item);
        return;
      }
      if (s.status === "failed" || s.status === "cancelled") {
        closeStream();
        patchHistory(id, { status: s.status, error: s.error });
        setView((v) => ({ ...v, status: s.status, error: s.error ?? null, retryable: s.retryable ?? true }));
        pushEvent({ type: `job.${s.status}`, message: s.error ?? `Job ${s.status}.` });
        return;
      }
      const mapped: JobStatus = s.status === "synthesizing" ? "synthesizing" : s.status;
      patchHistory(id, { status: mapped });
      setView((v) => ({ ...v, status: mapped }));
      const elapsed = Date.now() - startedAt.current;
      timer.current = setTimeout(() => pollRef.current(item), elapsed > SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const e = err instanceof ApiError ? err : new ApiError("Could not reach the server.", 0, true);
      if (e.retryable && e.status !== 404 && e.status !== 503) {
        pushEvent({ type: "poll.retry", message: `Status check failed (${e.message}). Retrying.` });
        timer.current = setTimeout(() => pollRef.current(item), POLL_SLOW_MS);
        return;
      }
      patchHistory(id, { status: "failed", error: e.message });
      setView((v) => ({ ...v, status: "failed", error: e.message, retryable: e.retryable }));
      pushEvent({ type: "job.failed", message: e.message });
    }
  }, [id, pushEvent, synthesize, openStream, closeStream]);

  useEffect(() => {
    pollRef.current = poll;
    openStreamRef.current = openStream;
  }, [poll, openStream]);

  useEffect(() => {
    stopped.current = false;
    startedAt.current = Date.now();
    const ctrl = new AbortController();
    abort.current = ctrl;
    // Runs after hydration; every transition below reflects stored or server state.
    const init = async () => {
      if (isSample) {
        try {
          const { report } = await fetchReport(id, undefined, ctrl.signal);
          setView((v) => ({ ...v, status: "completed", report, error: null }));
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const e = err instanceof ApiError ? err : new ApiError("Could not load the sample report.", 500, true);
          setView((v) => ({ ...v, status: e.status === 404 ? "missing" : "failed", error: e.message, retryable: e.retryable }));
        }
        return;
      }
      const item = getHistoryItem(id);
      if (!item) {
        setView((v) => ({ ...v, status: "missing", error: "This research is not in this browser's history. Reports are stored locally in the browser that created them." }));
        return;
      }
      const restored = { trace: item.trace ?? [], traceStats: item.traceStats ?? null };
      for (const t of restored.trace) seen.current.add(`${t.type}|${t.at}|${t.message}`);
      if (item.report) {
        setView((v) => ({ ...v, item, events: item.events ?? [], status: "completed", report: item.report ?? null, ...restored }));
        return;
      }
      setView((v) => ({ ...v, item, events: item.events ?? [], status: item.status, error: item.error ?? null, retryable: true, ...restored }));
      if (item.status === "failed" || item.status === "cancelled") return;
      if (item.status === "synthesizing") await synthesize(item);
      else await poll(item);
    };
    void init();
    return () => {
      stopPolling();
      ctrl.abort();
    };
  }, [id, isSample, poll, synthesize, stopPolling]);

  const cancel = useCallback(() => {
    stopPolling();
    patchHistory(id, { status: "cancelled", error: "Cancelled in the browser. The provider run may continue to completion and is billed by the provider regardless." });
    setView((v) => ({ ...v, status: "cancelled", cancelled: true, error: "Cancelled in the browser. The provider run may continue to completion and is billed by the provider regardless." }));
    pushEvent({ type: "job.cancelled", message: "Polling stopped by the user. The provider does not expose a cancel endpoint, so the run itself was not cancelled." });
  }, [id, pushEvent, stopPolling]);

  const retry = useCallback(() => {
    const item = getHistoryItem(id);
    if (!item) return;
    stopped.current = false;
    startedAt.current = Date.now();
    setView((v) => ({ ...v, error: null, cancelled: false }));
    pushEvent({ type: "job.retry", message: "Retrying from the current provider state." });
    if (item.status === "synthesizing" || view.status === "failed" && view.providerStatus === "completed") {
      void synthesize(item);
    } else {
      patchHistory(id, { status: "queued", error: undefined });
      setView((v) => ({ ...v, status: "queued" }));
      void poll(item);
    }
  }, [id, poll, pushEvent, synthesize, view.providerStatus, view.status]);

  return { view, cancel, retry };
}

export function rememberNewJob(item: HistoryItem) {
  return upsertHistory(item);
}
