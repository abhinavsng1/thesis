import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SynthesisOutputSchema, type SynthesisOutput } from "@/lib/schema/report";
import type { NormalizedEvidence } from "./evidence";
import { HORIZON_LABELS, type Horizon } from "@/lib/schema/request";

/**
 * Report synthesis: one bounded call that turns the normalized evidence
 * document into the structured report. The model only ever sees the compact
 * evidence document (not the raw corpus), and its output is validated with
 * Zod by the SDK before we accept it, then re-validated server-side.
 */

/** Observable progress of the synthesis call: real token counts and the sections the model has reached. */
export interface SynthesisProgress {
  attempt: number;
  outputTokens: number;
  sections: string[];
}

export interface SynthesisInput {
  onProgress?: (p: SynthesisProgress) => void;
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

/**
 * Wire schema handed to the model. It mirrors SynthesisOutputSchema's shape but
 * carries no length, pattern or array-size constraints: Anthropic compiles the
 * schema into a grammar and the constrained version exceeds its size limit.
 * The server coerces the result (truncating overlong text, slicing arrays) and
 * then validates it against the full schema.
 */
const Kind = z.enum(["reported", "guidance", "consensus", "assumption", "inference"]);
const WireClaim = z.object({ text: z.string(), kind: Kind, sourceIds: z.array(z.string()) });
const WirePoint = z.object({ period: z.string(), value: z.number().nullable() });
export const SynthesisWireSchema = z.object({
  title: z.string(),
  stance: z.string(),
  asOf: z.string(),
  brief: z.object({ answer: WireClaim, opportunity: WireClaim, risk: WireClaim, uncertainty: WireClaim }),
  thesis: z.array(z.object({ claim: z.string(), evidence: z.string(), implication: z.string(), kind: Kind, sourceIds: z.array(z.string()) })),
  metrics: z
    .object({
      title: z.string(),
      currency: z.string().nullable(),
      periodNote: z.string().nullable(),
      rows: z.array(
        z.object({
          metric: z.string(),
          entity: z.string().nullable(),
          unit: z.string(),
          note: z.string().nullable(),
          values: z.array(z.object({ period: z.string(), value: z.number().nullable(), isEstimate: z.boolean(), sourceIds: z.array(z.string()) })),
        }),
      ),
    })
    .nullable(),
  charts: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["bar", "line", "stacked-bar", "grouped-bar"]),
      title: z.string(),
      unit: z.string(),
      currency: z.string().nullable(),
      periodNote: z.string().nullable(),
      series: z.array(z.object({ name: z.string(), isForecast: z.boolean(), isDownside: z.boolean(), points: z.array(WirePoint) })),
      takeaway: z.string(),
      sourceIds: z.array(z.string()),
    }),
  ),
  scenarios: z
    .object({
      methodology: z.string(),
      cases: z.array(z.object({ name: z.enum(["bear", "base", "bull"]), summary: z.string(), assumptions: z.array(z.string()), outcome: z.string(), sourceIds: z.array(z.string()) })),
      sensitivity: z
        .object({ variable: z.string(), columns: z.array(z.string()), rows: z.array(z.object({ label: z.string(), values: z.array(z.string()) })), note: z.string().nullable() })
        .nullable(),
      caveat: z.string().nullable(),
    })
    .nullable(),
  risks: z.array(z.object({ title: z.string(), detail: z.string(), kind: z.enum(["evidence_against", "execution", "financial", "invalidator"]), sourceIds: z.array(z.string()) })),
  catalysts: z.array(z.object({ event: z.string(), timing: z.string(), watch: z.string().nullable(), sourceIds: z.array(z.string()) })),
  limitations: z.object({ missing: z.array(z.string()), uncertainties: z.array(z.string()), conflicts: z.array(z.string()) }),
});
export type SynthesisWire = z.infer<typeof SynthesisWireSchema>;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Removes label prefixes the model sometimes echoes from the field name, e.g. "Answer: …". */
const unlabel = (s: string) => s.replace(/^\s*(answer|opportunity|risk|key uncertainty|uncertainty|evidence|implication|so what)\s*[:.\-–—]\s*/i, "");
const ids = (xs: string[], n: number) => [...new Set(xs.map((x) => x.trim().toUpperCase()))].slice(0, n);
const opt = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

/** Brings a wire-shaped result inside the full schema's bounds before validation. */
export function coerceWire(w: SynthesisWire): SynthesisOutput {
  const claim = (c: z.infer<typeof WireClaim>) => ({ text: cut(unlabel(c.text), 900), kind: c.kind, sourceIds: ids(c.sourceIds, 8) });
  const out = {
    title: cut(w.title, 140),
    stance: cut(w.stance, 400),
    asOf: cut(w.asOf, 40),
    brief: { answer: claim(w.brief.answer), opportunity: claim(w.brief.opportunity), risk: claim(w.brief.risk), uncertainty: claim(w.brief.uncertainty) },
    thesis: w.thesis.slice(0, 5).map((t) => ({ claim: cut(unlabel(t.claim), 200), evidence: cut(unlabel(t.evidence), 700), implication: cut(unlabel(t.implication), 400), kind: t.kind, sourceIds: ids(t.sourceIds, 8) })),
    metrics:
      w.metrics && w.metrics.rows.length
        ? {
            title: cut(w.metrics.title || "Financial evidence", 120),
            currency: opt(w.metrics.currency && cut(w.metrics.currency, 10)),
            periodNote: opt(w.metrics.periodNote && cut(w.metrics.periodNote, 400)),
            rows: w.metrics.rows.slice(0, 16).map((r) => ({
              metric: cut(r.metric, 80),
              entity: opt(r.entity && cut(r.entity, 60)),
              unit: cut(r.unit || "n/a", 30),
              note: opt(r.note && cut(r.note, 200)),
              values: r.values.slice(0, 12).map((v) => ({ period: cut(v.period, 40), value: Number.isFinite(v.value as number) ? v.value : null, isEstimate: v.isEstimate, sourceIds: ids(v.sourceIds, 4) })),
            })).filter((r) => r.values.length > 0),
          }
        : undefined,
    charts: w.charts.slice(0, 4).map((c, i) => ({
      id: cut(c.id || `chart-${i + 1}`, 40),
      kind: c.kind,
      title: cut(c.title, 120),
      unit: cut(c.unit || "n/a", 30),
      currency: opt(c.currency && cut(c.currency, 10)),
      periodNote: opt(c.periodNote && cut(c.periodNote, 400)),
      series: c.series.slice(0, 5).map((s) => ({ name: cut(s.name, 60), isForecast: s.isForecast, isDownside: s.isDownside, points: s.points.slice(0, 24).map((p) => ({ period: cut(p.period, 40), value: Number.isFinite(p.value as number) ? p.value : null })) })).filter((s) => s.points.length > 0),
      takeaway: cut(c.takeaway, 320),
      sourceIds: ids(c.sourceIds, 8),
    })).filter((c) => c.series.length > 0),
    scenarios:
      w.scenarios && w.scenarios.cases.length === 3
        ? {
            methodology: cut(w.scenarios.methodology, 500),
            cases: w.scenarios.cases.map((c) => ({ name: c.name, summary: cut(c.summary, 400), assumptions: c.assumptions.slice(0, 6).map((a) => cut(a, 220)), outcome: cut(c.outcome, 300), sourceIds: ids(c.sourceIds, 6) })),
            sensitivity:
              w.scenarios.sensitivity && w.scenarios.sensitivity.columns.length >= 2 && w.scenarios.sensitivity.rows.length
                ? {
                    variable: cut(w.scenarios.sensitivity.variable, 120),
                    columns: w.scenarios.sensitivity.columns.slice(0, 6).map((c) => cut(c, 40)),
                    rows: w.scenarios.sensitivity.rows.slice(0, 6).map((r) => ({ label: cut(r.label, 80), values: r.values.slice(0, 6).map((v) => cut(v, 40)) })),
                    note: opt(w.scenarios.sensitivity.note && cut(w.scenarios.sensitivity.note, 240)),
                  }
                : undefined,
            caveat: opt(w.scenarios.caveat && cut(w.scenarios.caveat, 400)),
          }
        : undefined,
    risks: w.risks.slice(0, 8).map((r) => ({ title: cut(r.title, 140), detail: cut(r.detail, 600), kind: r.kind, sourceIds: ids(r.sourceIds, 6) })),
    catalysts: w.catalysts.slice(0, 8).map((c) => ({ event: cut(c.event, 200), timing: cut(c.timing || "not disclosed", 160), watch: opt(c.watch && cut(c.watch, 240)), sourceIds: ids(c.sourceIds, 4) })),
    limitations: {
      missing: w.limitations.missing.slice(0, 8).map((m) => cut(m, 240)),
      uncertainties: w.limitations.uncertainties.slice(0, 8).map((m) => cut(m, 240)),
      conflicts: w.limitations.conflicts.slice(0, 6).map((m) => cut(m, 300)),
    },
  };
  return SynthesisOutputSchema.parse(out);
}

/** Stable instructions first so the prefix can be cached across runs. */
const WIRE_JSON_SCHEMA = JSON.stringify(z.toJSONSchema(SynthesisWireSchema));

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
- asOf is the latest date the evidence is current to, in YYYY-MM-DD form.
- Use null for optional fields you do not fill (currency, periodNote, note, entity, watch, sensitivity, caveat, metrics, scenarios). Source ids are exactly as given in the evidence (S1, S2…). Keep "id" on each chart a short slug.

Output format: respond with exactly one JSON object and nothing else (no prose, no code fences) that validates against this JSON Schema:
${WIRE_JSON_SCHEMA}`;

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
  const call = async (attempt: number, extraUser?: string) => {
    try {
      const stream = client.messages.stream({
        model: input.model,
        max_tokens: 16_000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserPrompt(input) + (extraUser ? `\n\n${extraUser}` : "") }],
        output_config: { effort: input.effort },
      });
      if (input.onProgress) {
        let acc = "";
        let chars = 0;
        let lastEmit = 0;
        const seen: string[] = [];
        stream.on("text", (delta) => {
          acc += delta;
          chars += delta.length;
          for (const key of SECTION_KEYS) {
            if (!seen.includes(key) && acc.includes(`"${key}"`)) seen.push(key);
          }
          const t = Date.now();
          if (t - lastEmit > 400) {
            lastEmit = t;
            // Output tokens are only known at the end; report a character-based estimate until then, labelled as such by the UI.
            input.onProgress?.({ attempt, outputTokens: Math.round(chars / 4), sections: [...seen] });
          }
        });
      }
      return await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) throw new SynthesisError("Synthesis model rejected the API key.", false);
      if (err instanceof Anthropic.RateLimitError) throw new SynthesisError("Synthesis model rate limit reached. Try again shortly.", true);
      if (err instanceof Anthropic.APIConnectionTimeoutError) throw new SynthesisError("Synthesis model timed out.", true);
      if (err instanceof Anthropic.APIError) {
        // Log the provider's validation message server-side (never includes secrets); keep the browser message short.
        console.error("[thesis] synthesis API error", err.status, err.message.slice(0, 600));
        throw new SynthesisError(`Synthesis model error (${err.status ?? "network"}).`, (err.status ?? 500) >= 500);
      }
      throw new SynthesisError("Synthesis failed unexpectedly.", true);
    }
  };

  let output: SynthesisOutput | null = null;
  const totals = { model: input.model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let lastProblem = "";
  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    const message = await call(attempt + 1, attempt === 0 ? undefined : `Your previous answer was not valid JSON for the schema (${lastProblem.slice(0, 300)}). Return only the corrected JSON object.`);
    if (message.stop_reason === "refusal") throw new SynthesisError("Synthesis model declined this request.", false);
    if (message.stop_reason === "max_tokens") throw new SynthesisError("Synthesis output was cut off; retry with a smaller budget.", true);
    const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    totals.model = message.model;
    totals.inputTokens += message.usage.input_tokens;
    totals.outputTokens += message.usage.output_tokens;
    totals.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
    try {
      const wire = SynthesisWireSchema.safeParse(extractJson(text));
      if (!wire.success) {
        lastProblem = wire.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        console.error("[thesis] synthesis output invalid", lastProblem.slice(0, 600));
        continue;
      }
      output = coerceWire(wire.data);
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : String(err);
      console.error("[thesis] synthesis output failed validation", lastProblem.slice(0, 600));
    }
  }
  if (!output) throw new SynthesisError("Synthesis output did not match the report schema after two attempts.", true);
  const usage: SynthesisResult["usage"] = { model: totals.model, inputTokens: totals.inputTokens, outputTokens: totals.outputTokens, cacheReadTokens: totals.cacheReadTokens || undefined };
  return { output, usage };
}

/** Top-level report keys in the order the model writes them; used to report drafting progress. */
export const SECTION_KEYS = ["title", "stance", "brief", "thesis", "metrics", "charts", "scenarios", "risks", "catalysts", "limitations"] as const;

/** Pulls the first JSON object out of a text response, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in response");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
