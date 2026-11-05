import { getConfig } from "./config";
import { ParallelProvider } from "./parallel";
import { ProviderError, type ResearchProvider } from "./provider";
import { normalizeEvidence } from "./evidence";
import { synthesizeReport, SynthesisError, type SynthesisProgress } from "./synthesis";
import { validateAndRepair } from "@/lib/report/validate";
import { computeStats } from "@/lib/report/stats";
import { ReportSchema, type Report } from "@/lib/schema/report";
import type { ActivityEvent, JobStatus, JobStatusResponse, ResearchRequest } from "@/lib/schema/request";
import { getSampleReport, isSampleId } from "./samples";

/**
 * Research job lifecycle.
 *
 * The provider run id IS the job id. There is no database: status is
 * proxied from the provider on every poll, and the synthesized report is
 * cached in process memory (best effort on serverless; the browser keeps its
 * own durable copy in localStorage once it has the report).
 *
 * Idempotency: a client-supplied key maps to a run id for a short window so
 * a double submit does not create a second paid run on a warm instance.
 */

type CacheEntry<T> = { value: T; expiresAt: number };
const TTL_MS = 60 * 60 * 1000;

// Module-level maps survive across requests on a warm instance only.
const idempotency = new Map<string, CacheEntry<string>>();
const reports = new Map<string, CacheEntry<Report>>();
const inflight = new Map<string, Promise<Report>>();
const created = new Map<string, CacheEntry<{ request: ResearchRequest; createdAt: string; processor: string }>>();

function getFresh<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    map.delete(key);
    return undefined;
  }
  return e.value;
}
function setFresh<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

let providerSingleton: ResearchProvider | null = null;
export function getProvider(): ResearchProvider {
  if (providerSingleton) return providerSingleton;
  const c = getConfig();
  if (!c.parallel.apiKey) throw new ProviderError("Live research is not configured.", "unauthorized", false);
  providerSingleton = new ParallelProvider({
    apiKey: c.parallel.apiKey,
    baseUrl: c.parallel.baseUrl,
    processorQuick: c.parallel.processorQuick,
    processorDeep: c.parallel.processorDeep,
  });
  return providerSingleton;
}

/** Test seam. */
export function _setProviderForTests(p: ResearchProvider | null) {
  providerSingleton = p;
  idempotency.clear();
  reports.clear();
  inflight.clear();
  created.clear();
}

/** Observable stages of report building, streamed to the browser during synthesis. */
export type ReportProgress =
  | { stage: "result"; sources: number }
  | { stage: "evidence"; sources: number; facts: number; metrics: number; truncated: boolean }
  | { stage: "drafting"; attempt: number; outputTokensEstimate: number; sections: string[] }
  | { stage: "validating"; charts: number; citations: number }
  | { stage: "done"; words: number };

export class JobError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryable: boolean) {
    super(message);
    this.name = "JobError";
  }
}

function toJobError(err: unknown): JobError {
  if (err instanceof JobError) return err;
  if (err instanceof ProviderError) {
    const status = err.code === "rate_limited" ? 429 : err.code === "timeout" ? 504 : err.code === "not_found" ? 404 : err.code === "invalid_request" ? 422 : 502;
    return new JobError(err.message, status, err.retryable);
  }
  if (err instanceof SynthesisError) return new JobError(err.message, 502, err.retryable);
  return new JobError("Something went wrong while processing the research job.", 500, true);
}

export interface CreateJobResult {
  id: string;
  status: JobStatus;
  processor: string;
  createdAt: string;
  reused: boolean;
}

export async function createJob(request: ResearchRequest, idempotencyKey?: string): Promise<CreateJobResult> {
  const provider = getProvider();
  if (idempotencyKey) {
    const existing = getFresh(idempotency, idempotencyKey);
    if (existing) {
      const meta = getFresh(created, existing);
      return { id: existing, status: "queued", processor: meta?.processor ?? provider.processorFor(request.depth), createdAt: meta?.createdAt ?? new Date().toISOString(), reused: true };
    }
  }
  try {
    const run = await provider.createRun({ question: request.question, depth: request.depth, horizon: request.horizon, clientKey: idempotencyKey });
    const createdAt = run.createdAt ?? new Date().toISOString();
    const processor = run.processor ?? provider.processorFor(request.depth);
    setFresh(created, run.runId, { request, createdAt, processor });
    if (idempotencyKey) setFresh(idempotency, idempotencyKey, run.runId);
    return { id: run.runId, status: mapProviderStatus(run.status), processor, createdAt, reused: false };
  } catch (err) {
    throw toJobError(err);
  }
}

function mapProviderStatus(s: string): JobStatus {
  switch (s) {
    case "queued":
      return "queued";
    case "running":
      return "researching";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "failed";
  }
}

export async function getJobStatus(id: string): Promise<JobStatusResponse> {
  if (isSampleId(id)) {
    return { id, status: "completed", providerStatus: "sample", events: [] };
  }
  if (getFresh(reports, id)) {
    return { id, status: "completed", providerStatus: "completed", events: [] };
  }
  if (inflight.has(id)) {
    return { id, status: "synthesizing", providerStatus: "completed", events: [] };
  }
  const provider = getProvider();
  try {
    const run = await provider.getRun(id);
    const status = mapProviderStatus(run.status);
    const events: ActivityEvent[] = [];
    const resp: JobStatusResponse = {
      id,
      status,
      providerStatus: run.status,
      createdAt: run.createdAt,
      updatedAt: run.modifiedAt,
      events,
    };
    if (status === "failed") {
      resp.error = run.status === "action_required" ? "The research provider needs manual action on this run; it cannot continue automatically." : run.errorMessage ?? "The research run failed at the provider.";
      resp.retryable = true;
    }
    return resp;
  } catch (err) {
    throw toJobError(err);
  }
}

/**
 * Returns the finished report, synthesizing it on first request after the
 * provider run completes. Concurrent callers share one in-flight synthesis.
 */
export async function getJobReport(id: string, requestHint?: Partial<ResearchRequest>, onProgress?: (p: ReportProgress) => void): Promise<{ report: Report; events: ActivityEvent[] }> {
  if (isSampleId(id)) {
    const sample = getSampleReport(id);
    if (!sample) throw new JobError("Sample report not found.", 404, false);
    return { report: sample, events: [] };
  }
  const cached = getFresh(reports, id);
  if (cached) return { report: cached, events: [] };
  let p = inflight.get(id);
  if (!p) {
    p = buildReport(id, requestHint, onProgress).finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  try {
    const report = await p;
    return { report, events: [] };
  } catch (err) {
    throw toJobError(err);
  }
}

async function buildReport(id: string, hint?: Partial<ResearchRequest>, onProgress?: (p: ReportProgress) => void): Promise<Report> {
  const provider = getProvider();
  const cfg = getConfig();
  const result = await provider.getResult(id);
  if (result.run.status !== "completed") throw new JobError("Research is not finished yet.", 409, true);
  onProgress?.({ stage: "result", sources: new Set(result.basis.flatMap((b) => b.citations.map((c) => c.url))).size });
  const meta = getFresh(created, id);
  const question = meta?.request.question ?? hint?.question;
  if (!question) throw new JobError("The original question for this run is unknown on this server. Reopen the report from the browser that created it.", 400, false);
  const depth = meta?.request.depth ?? hint?.depth ?? "quick";
  const horizon = meta?.request.horizon ?? hint?.horizon;
  const budgetWords = meta?.request.budgetWords ?? hint?.budgetWords ?? 1000;
  const retrievedAt = new Date().toISOString();

  const evidence = normalizeEvidence(result, { retrievedAt, maxChars: cfg.synthesis.maxEvidenceChars });
  if (evidence.sources.length === 0) throw new JobError("The research run returned no citable sources, so no report was produced.", 502, true);
  onProgress?.({ stage: "evidence", sources: evidence.sources.length, facts: evidence.pack?.facts.length ?? 0, metrics: evidence.pack?.metrics.length ?? 0, truncated: evidence.truncated });

  const synth = await synthesizeReport({
    question,
    depth,
    horizon,
    budgetWords,
    evidence,
    model: cfg.synthesis.model,
    effort: cfg.synthesis.effort,
    onProgress: (sp: SynthesisProgress) => onProgress?.({ stage: "drafting", attempt: sp.attempt, outputTokensEstimate: sp.outputTokens, sections: sp.sections }),
  });
  onProgress?.({ stage: "validating", charts: synth.output.charts.length, citations: evidence.sources.length });
  const processor = result.run.processor ?? meta?.processor ?? provider.processorFor(depth);
  const base = {
    id,
    mode: "live" as const,
    question,
    depth,
    horizon,
    createdAt: meta?.createdAt ?? result.run.createdAt ?? retrievedAt,
    completedAt: new Date().toISOString(),
    researchCutoff: `Sources retrieved ${retrievedAt.slice(0, 10)} via ${provider.name} (${processor}).`,
    ...synth.output,
    sources: evidence.sources,
    usage: {
      synthesis: synth.usage,
      provider: { name: provider.name, processor, runId: id, listPriceUsd: provider.listPriceUsd(processor) },
    },
  };
  const withStats = { ...base, stats: computeStats(base) };
  const candidate = ReportSchema.parse(withStats);
  const { report } = validateAndRepair(candidate);
  setFresh(reports, id, report);
  onProgress?.({ stage: "done", words: report.stats.wordCount });
  return report;
}
