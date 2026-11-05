"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/schema/report";
import type { ActivityEvent, JobStatus } from "@/lib/schema/request";
import { ApiError, fetchReport, fetchStatus } from "./api";
import { getHistoryItem, patchHistory, upsertHistory, type HistoryItem } from "./history";

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
}

const POLL_FAST_MS = 4000;
const POLL_SLOW_MS = 8000;
const SLOW_AFTER_MS = 2 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

export function useResearchJob(id: string) {
  const isSample = id.startsWith("sample-");
  const [view, setView] = useState<JobView>({ id, status: "loading", item: null, report: null, error: null, retryable: false, events: [], lastPolledAt: null, cancelled: false });
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

  const stopPolling = useCallback(() => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    abort.current?.abort();
  }, []);

  const synthesize = useCallback(async (item: HistoryItem) => {
    setView((v) => ({ ...v, status: "synthesizing", error: null }));
    patchHistory(id, { status: "synthesizing" });
    pushEvent({ type: "synthesis.started", message: "Research complete. Synthesizing the report from the evidence pack." });
    try {
      const ctrl = new AbortController();
      abort.current = ctrl;
      const { report } = await fetchReport(id, { question: item.question, depth: item.depth, horizon: item.horizon, budgetWords: item.budgetWords }, ctrl.signal);
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
  }, [id, pushEvent]);

  const poll = useCallback(async (item: HistoryItem) => {
    if (stopped.current) return;
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
  }, [id, pushEvent, synthesize]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

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
      if (item.report) {
        setView((v) => ({ ...v, item, events: item.events ?? [], status: "completed", report: item.report ?? null }));
        return;
      }
      setView((v) => ({ ...v, item, events: item.events ?? [], status: item.status, error: item.error ?? null, retryable: true }));
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
