import type { Depth } from "@/lib/schema/request";

/**
 * Provider-agnostic contract for the research stage. Anything that can
 * start an asynchronous research run, report its status, and hand back
 * evidence with citations can sit behind this interface.
 */

export type ProviderRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "action_required";

export interface ProviderCitation {
  url: string;
  title?: string | null;
  excerpts?: string[] | null;
}

/** One output field of the provider's structured result, with its supporting citations. */
export interface ProviderBasis {
  field: string;
  citations: ProviderCitation[];
  reasoning?: string;
  confidence?: string | null;
}

export interface ProviderRun {
  runId: string;
  status: ProviderRunStatus;
  createdAt?: string;
  modifiedAt?: string;
  processor?: string;
  errorMessage?: string;
}

export interface ProviderResult {
  run: ProviderRun;
  /** Structured evidence pack when the provider honoured our JSON schema; raw text otherwise. */
  output: { type: "json"; content: unknown } | { type: "text"; content: string };
  basis: ProviderBasis[];
}

export interface CreateRunInput {
  question: string;
  depth: Depth;
  horizon?: string;
  /** Opaque key the provider may store as metadata for traceability. */
  clientKey?: string;
}

export interface ResearchProvider {
  readonly name: string;
  processorFor(depth: Depth): string;
  createRun(input: CreateRunInput): Promise<ProviderRun>;
  getRun(runId: string): Promise<ProviderRun>;
  /** Fetch the result once the run is completed. Must not block for long. */
  getResult(runId: string): Promise<ProviderResult>;
  /** Published list price per successful run for the processor, in USD, if known. */
  listPriceUsd(processor: string): number | undefined;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unauthorized"
      | "payment_required"
      | "forbidden"
      | "not_found"
      | "timeout"
      | "rate_limited"
      | "invalid_request"
      | "upstream"
      | "malformed",
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
