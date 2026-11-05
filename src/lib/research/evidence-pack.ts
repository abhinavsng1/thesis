import { z } from "zod";

/**
 * The compact, structured evidence pack we ask the research provider to
 * return. Keeping this flat (object → array → object → primitives) stays
 * inside Parallel's documented JSON-schema limits and gives us typed facts
 * with per-field citations instead of a wall of prose.
 */

export const EvidencePackSchema = z.object({
  summary: z.string(),
  facts: z.array(
    z.object({
      claim: z.string(),
      period: z.string(),
      kind: z.enum(["reported", "guidance", "consensus", "inference"]),
    }),
  ),
  metrics: z.array(
    z.object({
      entity: z.string(),
      metric: z.string(),
      period: z.string(),
      value: z.number(),
      unit: z.string(),
      currency: z.string(),
      is_estimate: z.boolean(),
    }),
  ),
  risks: z.array(z.string()),
  catalysts: z.array(
    z.object({
      event: z.string(),
      timing: z.string(),
    }),
  ),
  conflicts: z.array(z.string()),
  missing: z.array(z.string()),
  as_of: z.string(),
});
export type EvidencePack = z.infer<typeof EvidencePackSchema>;

/** JSON Schema handed to the provider. Mirrors EvidencePackSchema; descriptions steer the researcher. */
export const EVIDENCE_PACK_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "facts", "metrics", "risks", "catalysts", "conflicts", "missing", "as_of"],
  properties: {
    summary: {
      type: "string",
      description:
        "Two to four sentences answering the question directly from the evidence. No marketing language.",
    },
    facts: {
      type: "array",
      description:
        "Fifteen to thirty distinct, non-overlapping facts that matter for the question. Each must be verifiable from the cited source. Prefer primary sources: 10-K/10-Q/annual reports, earnings releases, investor presentations, earnings call transcripts, regulatory filings, official datasets.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "period", "kind"],
        properties: {
          claim: { type: "string", description: "One sentence. Include the number, unit and currency when the fact is numeric." },
          period: { type: "string", description: "Reporting period or date the fact refers to, e.g. 'FY2025 (ended 30 Jun 2025)' or 'Q3 FY2026'." },
          kind: {
            type: "string",
            enum: ["reported", "guidance", "consensus", "inference"],
            description: "reported = disclosed historical fact; guidance = management outlook; consensus = third-party estimate; inference = your own analytical reading.",
          },
        },
      },
    },
    metrics: {
      type: "array",
      description:
        "Numeric time series for charts and tables: revenue, operating income, net income, free cash flow, capex, segment revenue, margins, growth rates. Use one row per entity-metric-period. Use consistent units within a metric (e.g. USD billions). Mark estimates.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entity", "metric", "period", "value", "unit", "currency", "is_estimate"],
        properties: {
          entity: { type: "string", description: "Company or segment name." },
          metric: { type: "string" },
          period: { type: "string", description: "e.g. 'FY2024', 'FY2025', 'Q1 FY2026'. Say whether fiscal or calendar if ambiguous." },
          value: { type: "number" },
          unit: { type: "string", description: "'bn', 'm', '%', 'x', 'per share'." },
          currency: { type: "string", description: "ISO code like USD, or 'n/a' for ratios." },
          is_estimate: { type: "boolean", description: "true for guidance, consensus or your estimate; false for reported figures." },
        },
      },
    },
    risks: {
      type: "array",
      description: "Five to eight specific risks or counterarguments, each grounded in evidence and stated in one sentence.",
      items: { type: "string" },
    },
    catalysts: {
      type: "array",
      description: "Upcoming dated events or developments to monitor (earnings dates, product launches, regulatory decisions). Timing must be sourced; say 'not disclosed' otherwise.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["event", "timing"],
        properties: { event: { type: "string" }, timing: { type: "string" } },
      },
    },
    conflicts: {
      type: "array",
      description: "Places where sources disagree or figures are stated on different bases (fiscal vs calendar, GAAP vs non-GAAP, restated segments).",
      items: { type: "string" },
    },
    missing: {
      type: "array",
      description: "Information you looked for but could not find or verify, including anything that would need live market data.",
      items: { type: "string" },
    },
    as_of: {
      type: "string",
      description: "The latest publication date among the sources you relied on, as YYYY-MM-DD.",
    },
  },
} as const;
