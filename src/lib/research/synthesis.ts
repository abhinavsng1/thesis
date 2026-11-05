import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SynthesisOutputSchema, type SynthesisOutput } from "@/lib/schema/report";
import type { NormalizedEvidence } from "./evidence";
import { HORIZON_LABELS, type Horizon } from "@/lib/schema/request";

/**
 * Report synthesis: one bounded call that turns the normalized evidence
 * document into the structured report. The model only ever sees the compact
 * evidence document (not the raw corpus), and its output is validated with
 * Zod by the SDK before we accept it, then re-validated server-side.
 */

export interface SynthesisInput {
  question: string;
  depth: "quick" | "deep";
  horizon?: string;
  budgetWords: number;
  evidence: NormalizedEvidence;
  model: string;
  effort: "low" | "medium" | "high";
  client?: Anthropic;
}

export interface SynthesisResult {
  output: SynthesisOutput;
  usage: { model: string; inputTokens: number; outputTokens: number; cacheReadTokens?: number };
}

export class SynthesisError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "SynthesisError";
  }
}

/** Stable instructions first so the prefix can be cached across runs. */
export const SYSTEM_PROMPT = `You are a senior equity research analyst writing for bankers and professional investors. You produce a structured investment report from an evidence document.

Standards:
- Every claim must be supported by the evidence document and cite source ids (S1, S2…) that actually support it. Never cite a source for something it does not say. Leave sourceIds empty for pure analytical inference and mark kind "inference".
- Distinguish reported facts, management guidance, consensus estimates, model assumptions and analytical inference using the "kind" fields.
- Do not state current share prices, market capitalisations or valuation multiples unless the evidence contains them with a date. Never invent target prices.
- Keep reporting periods explicit (e.g. FY2025, Q1 FY2026) and never mix fiscal and calendar years in one chart or table without saying so in periodNote.
- Charts: only build a chart when the evidence has at least two reliable numeric points for it. Two to four charts for a detailed question, fewer if that answers it. Every chart needs a one-sentence analytical takeaway and real source ids. Use isForecast for guidance or estimates and isDownside for bear/negative series. Use the same unit across all series in a chart.
- Metrics table: compact; rows are metrics (optionally per entity for comparisons), values are per period; mark estimates.
- Scenarios: include only when the evidence supports them. Make assumptions explicit; describe outcomes qualitatively or with ranges tied to evidence, not point target prices. Omit the scenarios object otherwise.
- Write tightly. No boilerplate, no repeated conclusions, no disclaimers inside sections. Prefer tables and charts to paragraphs for numbers.
- The executive brief is four short labelled passages (answer, opportunity, risk, uncertainty) totalling roughly 100–150 words. "stance" is one descriptive analytical sentence, not a buy/sell verdict.
- List missing data, material uncertainties and conflicting evidence honestly in limitations; do not fill gaps.
- asOf is the latest date the evidence is current to, in YYYY-MM-DD form.`;

export function buildUserPrompt(input: Omit<SynthesisInput, "client" | "model" | "effort">): string {
  const horizon = input.horizon ? HORIZON_LABELS[input.horizon as Horizon] ?? input.horizon : "not specified";
  const target = input.budgetWords;
  return [
    `QUESTION: ${input.question}`,
    `HORIZON: ${horizon}`,
    `DEPTH: ${input.depth}`,
    `TARGET LENGTH: about ${target} words for the full report (brief + thesis + risks + catalysts + limitations prose). Adjust slightly to the question's complexity; shorter is better than padded.`,
    "",
    "EVIDENCE DOCUMENT (the only information you may rely on):",
    "<<<",
    input.evidence.document,
    ">>>",
    input.evidence.truncated ? "Note: the evidence document was truncated to fit the context budget. Say so in limitations." : "",
    "",
    "Produce the report now.",
  ].join("\n");
}

export async function synthesizeReport(input: SynthesisInput): Promise<SynthesisResult> {
  const client = input.client ?? new Anthropic({ maxRetries: 2, timeout: 240_000 });
  const message = await (async () => {
    try {
      return await client.messages.parse({
      model: input.model,
      max_tokens: 16_000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserPrompt(input) }],
        output_config: { format: zodOutputFormat(SynthesisOutputSchema), effort: input.effort },
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new SynthesisError("Synthesis model rejected the API key.", false);
      if (err instanceof Anthropic.RateLimitError) throw new SynthesisError("Synthesis model rate limit reached. Try again shortly.", true);
      if (err instanceof Anthropic.APIConnectionTimeoutError) throw new SynthesisError("Synthesis model timed out.", true);
      if (err instanceof Anthropic.APIError) throw new SynthesisError(`Synthesis model error (${err.status ?? "network"}).`, (err.status ?? 500) >= 500);
      throw new SynthesisError("Synthesis failed unexpectedly.", true);
    }
  })();
  if (message.stop_reason === "refusal") throw new SynthesisError("Synthesis model declined this request.", false);
  if (message.stop_reason === "max_tokens") throw new SynthesisError("Synthesis output was cut off; retry with a smaller budget.", true);
  if (!message.parsed_output) throw new SynthesisError("Synthesis output did not match the report schema.", true);
  const parsed = SynthesisOutputSchema.safeParse(message.parsed_output);
  if (!parsed.success) throw new SynthesisError("Synthesis output failed validation.", true);
  return {
    output: parsed.data,
    usage: {
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? undefined,
    },
  };
}
