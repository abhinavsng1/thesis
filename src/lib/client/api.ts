import type { Report } from "@/lib/schema/report";
import type { JobStatusResponse, ResearchRequestInput } from "@/lib/schema/request";
import type { PublicConfig } from "@/lib/research/config";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryable: boolean, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string; retryable?: boolean; code?: string }) | null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status}).`, res.status, body?.retryable ?? res.status >= 500, body?.code);
  }
  if (!body) throw new ApiError("Empty response from server.", res.status, true);
  return body;
}

export type ConfigResponse = PublicConfig & { samples: Array<{ id: string; title: string; question: string; asOf: string; stats: Report["stats"] }> };

export function fetchConfig(signal?: AbortSignal): Promise<ConfigResponse> {
  return fetch("/api/config", { signal, cache: "no-store" }).then((r) => parse<ConfigResponse>(r));
}

export interface CreateJobResponse {
  id: string;
  status: string;
  processor: string;
  createdAt: string;
  reused: boolean;
}

export function createResearch(input: ResearchRequestInput, idempotencyKey: string): Promise<CreateJobResponse> {
  return fetch("/api/research", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
  }).then((r) => parse<CreateJobResponse>(r));
}

export function fetchStatus(id: string, signal?: AbortSignal): Promise<JobStatusResponse> {
  return fetch(`/api/research/${encodeURIComponent(id)}`, { signal, cache: "no-store" }).then((r) => parse<JobStatusResponse>(r));
}

export function fetchReport(id: string, hint?: ResearchRequestInput, signal?: AbortSignal): Promise<{ report: Report }> {
  return fetch(`/api/research/${encodeURIComponent(id)}/report`, {
    method: hint ? "POST" : "GET",
    headers: hint ? { "content-type": "application/json" } : undefined,
    body: hint ? JSON.stringify(hint) : undefined,
    signal,
    cache: "no-store",
  }).then((r) => parse<{ report: Report }>(r));
}

export type ReportProgressEvent =
  | { stage: "result"; sources: number }
  | { stage: "evidence"; sources: number; facts: number; metrics: number; truncated: boolean }
  | { stage: "drafting"; attempt: number; outputTokensEstimate: number; sections: string[] }
  | { stage: "validating"; charts: number; citations: number }
  | { stage: "done"; words: number };

/** Streams report-building progress (SSE over a POST) and resolves with the report. */
export async function fetchReportStream(
  id: string,
  hint: ResearchRequestInput,
  onProgress: (p: ReportProgressEvent) => void,
  signal?: AbortSignal,
): Promise<{ report: Report }> {
  const res = await fetch(`/api/research/${encodeURIComponent(id)}/report`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(hint),
    signal,
    cache: "no-store",
  });
  if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("text/event-stream")) return parse<{ report: Report }>(res);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: { report: Report } | null = null;
  let failure: ApiError | null = null;
  const handle = (block: string) => {
    const lines = block.split("\n");
    const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
    const data = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
    if (!event || !data) return;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (event === "progress") onProgress(payload as ReportProgressEvent);
    else if (event === "report") result = payload as { report: Report };
    else if (event === "failed") {
      const f = payload as { error: string; retryable: boolean; status: number };
      failure = new ApiError(f.error, f.status, f.retryable);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (failure) throw failure;
  if (!result) throw new ApiError("The report stream ended without a report.", 502, true);
  return result;
}
