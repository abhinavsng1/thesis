import { z } from "zod";
import type {
  CreateRunInput,
  ProviderBasis,
  ProviderResult,
  ProviderRun,
  ProviderRunStatus,
  ResearchProvider,
} from "./provider";
import { ProviderError } from "./provider";
import { EVIDENCE_PACK_JSON_SCHEMA } from "./evidence-pack";
import { HORIZON_LABELS, type Depth, type Horizon } from "@/lib/schema/request";

/**
 * Parallel Task API adapter.
 * Endpoints, headers, status values and response shapes follow the
 * official docs read on 2026-11-05:
 *   POST https://api.parallel.ai/v1/tasks/runs           → 202, TaskRun
 *   GET  https://api.parallel.ai/v1/tasks/runs/{run_id}  → TaskRun
 *   GET  https://api.parallel.ai/v1/tasks/runs/{run_id}/result?timeout=N → TaskRunResult (408 while active)
 * Auth header: x-api-key. No cancel endpoint is documented for task runs.
 */

const TaskRunSchema = z.object({
  run_id: z.string(),
  status: z.enum(["queued", "action_required", "running", "completed", "failed", "cancelling", "cancelled"]),
  is_active: z.boolean().optional(),
  processor: z.string().optional(),
  created_at: z.string().optional(),
  modified_at: z.string().optional(),
  error: z.object({ message: z.string().optional() }).passthrough().nullable().optional(),
  warnings: z.unknown().optional(),
});

const CitationSchema = z.object({
  url: z.string(),
  title: z.string().nullable().optional(),
  excerpts: z.array(z.string()).nullable().optional(),
});

const FieldBasisSchema = z.object({
  field: z.string(),
  citations: z.array(CitationSchema).default([]),
  reasoning: z.string().optional().default(""),
  confidence: z.string().nullable().optional(),
});

const TaskRunResultSchema = z.object({
  run: TaskRunSchema,
  output: z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), content: z.unknown(), basis: z.array(FieldBasisSchema).default([]) }),
    z.object({ type: z.literal("text"), content: z.string(), basis: z.array(FieldBasisSchema).default([]) }),
  ]),
});

/** List prices per 1,000 successful runs from docs.parallel.ai/getting-started/pricing (read 2026-11-05). */
const LIST_PRICE_PER_1000_USD: Record<string, number> = {
  lite: 5,
  base: 10,
  core: 25,
  core2x: 50,
  pro: 100,
  ultra: 300,
  ultra2x: 600,
  ultra4x: 1200,
  ultra8x: 2400,
};

export interface ParallelOptions {
  apiKey: string;
  baseUrl: string;
  processorQuick: string;
  processorDeep: string;
  fetchImpl?: typeof fetch;
}

function mapStatus(s: z.infer<typeof TaskRunSchema>["status"]): ProviderRunStatus {
  switch (s) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelling":
    case "cancelled":
      return "cancelled";
    case "action_required":
      return "action_required";
  }
}

function toRun(r: z.infer<typeof TaskRunSchema>): ProviderRun {
  return {
    runId: r.run_id,
    status: mapStatus(r.status),
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
    processor: r.processor,
    errorMessage: r.error?.message,
  };
}

export function buildResearchInput(input: CreateRunInput): string {
  const horizon = input.horizon ? HORIZON_LABELS[input.horizon as Horizon] ?? input.horizon : undefined;
  return [
    "You are an equity research associate preparing an evidence pack for an investment question.",
    "",
    `Question: ${input.question}`,
    horizon ? `Investment horizon: ${horizon}.` : "",
    "",
    "Rules:",
    "- Prefer primary sources: annual and quarterly reports (10-K, 10-Q, 20-F), earnings releases, investor presentations, earnings call transcripts, regulatory filings, official datasets. Use reputable secondary sources only for context.",
    "- Every fact must be traceable to a specific source. Do not fill gaps with assumptions; list what is missing instead.",
    "- Do not provide current share prices or valuation multiples unless you cite a dated source that states them; say when figures are not current.",
    "- Keep reporting periods explicit and consistent. Flag fiscal-year versus calendar-year and GAAP versus non-GAAP differences under conflicts.",
    "- Numbers in metrics should be plain numbers in the stated unit (e.g. 281.7 with unit 'bn' and currency 'USD').",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export class ParallelProvider implements ResearchProvider {
  readonly name = "parallel";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ParallelOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  processorFor(depth: Depth): string {
    return depth === "deep" ? this.opts.processorDeep : this.opts.processorQuick;
  }

  listPriceUsd(processor: string): number | undefined {
    const per1000 = LIST_PRICE_PER_1000_USD[processor];
    return per1000 === undefined ? undefined : per1000 / 1000;
  }

  private headers(): Record<string, string> {
    return { "x-api-key": this.opts.apiKey, "content-type": "application/json" };
  }

  private async request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(`${this.opts.baseUrl}${path}`, { ...init, signal: controller.signal, cache: "no-store" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ProviderError("Research provider did not respond in time.", "timeout", true);
      }
      throw new ProviderError("Could not reach the research provider.", "upstream", true);
    } finally {
      clearTimeout(timer);
    }
  }

  private async fail(res: Response): Promise<never> {
    let message = `Research provider returned HTTP ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* body not JSON */
    }
    // Never forward raw provider payloads that might include internal detail; keep the message short.
    const safe = message.length > 240 ? `${message.slice(0, 240)}…` : message;
    switch (res.status) {
      case 401:
        throw new ProviderError("Research provider rejected the API key.", "unauthorized", false, 401);
      case 402:
        throw new ProviderError("Research provider account has insufficient credit.", "payment_required", false, 402);
      case 403:
        throw new ProviderError("Research provider refused the requested processor.", "forbidden", false, 403);
      case 404:
        throw new ProviderError("Research run was not found or has failed.", "not_found", false, 404);
      case 408:
        throw new ProviderError("Research run is still in progress.", "timeout", true, 408);
      case 422:
        throw new ProviderError(`Research provider rejected the request: ${safe}`, "invalid_request", false, 422);
      case 429:
        throw new ProviderError("Research provider rate limit reached. Try again shortly.", "rate_limited", true, 429);
      default:
        throw new ProviderError("Research provider is temporarily unavailable.", "upstream", res.status >= 500, res.status);
    }
  }

  async createRun(input: CreateRunInput): Promise<ProviderRun> {
    const body = {
      input: buildResearchInput(input),
      processor: this.processorFor(input.depth),
      task_spec: {
        output_schema: { type: "json", json_schema: EVIDENCE_PACK_JSON_SCHEMA },
      },
      metadata: {
        app: "thesis",
        depth: input.depth,
        ...(input.clientKey ? { client_key: input.clientKey.slice(0, 512) } : {}),
      },
    };
    const res = await this.request("/v1/tasks/runs", { method: "POST", headers: this.headers(), body: JSON.stringify(body) }, 20_000);
    if (!res.ok) await this.fail(res);
    const parsed = TaskRunSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new ProviderError("Research provider returned an unexpected response.", "malformed", false);
    return toRun(parsed.data);
  }

  async getRun(runId: string): Promise<ProviderRun> {
    const res = await this.request(`/v1/tasks/runs/${encodeURIComponent(runId)}`, { method: "GET", headers: this.headers() }, 15_000);
    if (!res.ok) await this.fail(res);
    const parsed = TaskRunSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new ProviderError("Research provider returned an unexpected status payload.", "malformed", false);
    return toRun(parsed.data);
  }

  async getResult(runId: string): Promise<ProviderResult> {
    // timeout=1 keeps this call short; a 408 means "still active" and is surfaced as a retryable timeout.
    const res = await this.request(
      `/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=1`,
      { method: "GET", headers: this.headers() },
      25_000,
    );
    if (!res.ok) await this.fail(res);
    const parsed = TaskRunResultSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new ProviderError("Research provider returned a result we could not parse.", "malformed", false);
    const { run, output } = parsed.data;
    const basis: ProviderBasis[] = output.basis.map((b) => ({
      field: b.field,
      citations: b.citations.map((c) => ({ url: c.url, title: c.title ?? null, excerpts: c.excerpts ?? null })),
      reasoning: b.reasoning,
      confidence: b.confidence ?? null,
    }));
    return {
      run: toRun(run),
      output: output.type === "json" ? { type: "json", content: output.content } : { type: "text", content: output.content },
      basis,
    };
  }
}
