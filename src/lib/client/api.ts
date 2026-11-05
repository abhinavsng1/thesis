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
