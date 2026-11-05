import { z } from "zod";

/**
 * Report schema — the single contract shared by live synthesis, fixtures,
 * the renderer, and the Markdown exporter. Everything the UI shows is
 * validated against this before it reaches the browser.
 */

export const EvidenceKind = z.enum([
  "reported", // audited/reported fact from filings or releases
  "guidance", // management guidance or outlook
  "consensus", // third-party estimate, where available
  "assumption", // explicit model assumption made in this report
  "inference", // analytical inference drawn from evidence
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const SourceKind = z.enum([
  "filing",
  "earnings_release",
  "presentation",
  "transcript",
  "regulatory",
  "dataset",
  "news",
  "other",
]);

const SourceId = z.string().regex(/^S\d{1,3}$/, "source ids look like S1, S2…");

export const SourceSchema = z.object({
  id: SourceId,
  title: z.string().min(1).max(300),
  url: z.string().url().refine((u) => /^https?:\/\//i.test(u), "http(s) only"),
  publisher: z.string().max(120).optional(),
  publishedAt: z.string().max(40).optional(), // ISO date or human date as provided
  period: z.string().max(60).optional(), // reporting period the source covers
  retrievedAt: z.string().datetime(),
  kind: SourceKind.default("other"),
  excerpts: z.array(z.string().max(600)).max(6).default([]),
});
export type Source = z.infer<typeof SourceSchema>;

export const ClaimSchema = z.object({
  text: z.string().min(1).max(900),
  kind: EvidenceKind.default("inference"),
  sourceIds: z.array(SourceId).max(8).default([]),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const ThesisPointSchema = z.object({
  claim: z.string().min(1).max(200),
  evidence: z.string().min(1).max(700),
  implication: z.string().min(1).max(400),
  kind: EvidenceKind.default("inference"),
  sourceIds: z.array(SourceId).max(8).default([]),
});
export type ThesisPoint = z.infer<typeof ThesisPointSchema>;

export const MetricValueSchema = z.object({
  period: z.string().min(1).max(40),
  value: z.number().finite().nullable(),
  isEstimate: z.boolean().default(false),
  sourceIds: z.array(SourceId).max(4).default([]),
});

export const MetricRowSchema = z.object({
  metric: z.string().min(1).max(80),
  entity: z.string().max(60).optional(), // company, for comparisons
  unit: z.string().min(1).max(30), // "USD bn", "%", "x"
  values: z.array(MetricValueSchema).min(1).max(12),
  note: z.string().max(200).optional(),
});
export type MetricRow = z.infer<typeof MetricRowSchema>;

export const MetricsTableSchema = z.object({
  title: z.string().max(120).default("Financial evidence"),
  currency: z.string().max(10).optional(),
  periodNote: z.string().max(400).optional(), // e.g. "Microsoft FY ends 30 June"
  rows: z.array(MetricRowSchema).min(1).max(16),
});
export type MetricsTable = z.infer<typeof MetricsTableSchema>;

export const ChartKind = z.enum(["bar", "line", "stacked-bar", "grouped-bar"]);

export const ChartSeriesSchema = z.object({
  name: z.string().min(1).max(60),
  isForecast: z.boolean().default(false),
  isDownside: z.boolean().default(false),
  points: z
    .array(
      z.object({
        period: z.string().min(1).max(40),
        value: z.number().finite().nullable(),
      }),
    )
    .min(1)
    .max(24),
});

export const ChartSchema = z.object({
  id: z.string().min(1).max(40),
  kind: ChartKind,
  title: z.string().min(1).max(120),
  unit: z.string().min(1).max(30),
  currency: z.string().max(10).optional(),
  periodNote: z.string().max(400).optional(),
  series: z.array(ChartSeriesSchema).min(1).max(5),
  takeaway: z.string().min(1).max(320),
  sourceIds: z.array(SourceId).min(1).max(8),
});
export type Chart = z.infer<typeof ChartSchema>;

export const ScenarioCaseSchema = z.object({
  name: z.enum(["bear", "base", "bull"]),
  summary: z.string().min(1).max(400),
  assumptions: z.array(z.string().max(220)).min(1).max(6),
  outcome: z.string().min(1).max(300), // described outcome, not a price target
  sourceIds: z.array(SourceId).max(6).default([]),
});

export const ScenariosSchema = z.object({
  methodology: z.string().min(1).max(500),
  cases: z.array(ScenarioCaseSchema).length(3),
  sensitivity: z
    .object({
      variable: z.string().min(1).max(120),
      columns: z.array(z.string().max(40)).min(2).max(6),
      rows: z.array(
        z.object({
          label: z.string().min(1).max(80),
          values: z.array(z.string().max(40)).min(2).max(6),
        }),
      ).min(1).max(6),
      note: z.string().max(240).optional(),
    })
    .optional(),
  caveat: z.string().max(400).optional(),
});

export const RiskSchema = z.object({
  title: z.string().min(1).max(140),
  detail: z.string().min(1).max(600),
  kind: z.enum(["evidence_against", "execution", "financial", "invalidator"]),
  sourceIds: z.array(SourceId).max(6).default([]),
});

export const CatalystSchema = z.object({
  event: z.string().min(1).max(200),
  timing: z.string().min(1).max(160), // sourced date or stated timing
  watch: z.string().max(240).optional(), // metric or signal to monitor
  sourceIds: z.array(SourceId).max(4).default([]),
});

export const UsageSchema = z.object({
  synthesis: z
    .object({
      model: z.string(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      cacheReadTokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
  provider: z
    .object({
      name: z.string(),
      processor: z.string(),
      runId: z.string(),
      /** Fixed list price per run as published on the provider's pricing page at build time. Labeled as list price, not a metered charge. */
      listPriceUsd: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const ReportSchema = z.object({
  id: z.string().min(1).max(80),
  mode: z.enum(["live", "sample"]),
  question: z.string().min(1).max(600),
  depth: z.enum(["quick", "deep"]),
  horizon: z.string().max(40).optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  /** Date the evidence is current to. Shown on every time-sensitive figure. */
  asOf: z.string().min(4).max(40),
  researchCutoff: z.string().min(4).max(300),
  title: z.string().min(1).max(140),
  stance: z.string().min(1).max(400),
  brief: z.object({
    answer: ClaimSchema,
    opportunity: ClaimSchema,
    risk: ClaimSchema,
    uncertainty: ClaimSchema,
  }),
  thesis: z.array(ThesisPointSchema).min(2).max(5),
  metrics: MetricsTableSchema.optional(),
  charts: z.array(ChartSchema).max(4).default([]),
  scenarios: ScenariosSchema.optional(),
  risks: z.array(RiskSchema).min(1).max(8),
  catalysts: z.array(CatalystSchema).max(8).default([]),
  limitations: z.object({
    missing: z.array(z.string().max(240)).max(8).default([]),
    uncertainties: z.array(z.string().max(240)).max(8).default([]),
    conflicts: z.array(z.string().max(300)).max(6).default([]),
  }),
  sources: z.array(SourceSchema).min(1).max(60),
  stats: z.object({
    wordCount: z.number().int().nonnegative(),
    readingMinutes: z.number().int().positive(),
  }),
  usage: UsageSchema.optional(),
  sampleNotice: z.string().max(600).optional(),
});
export type Report = z.infer<typeof ReportSchema>;

/** Everything the synthesis model is asked to produce. The server fills the rest. */
export const SynthesisOutputSchema = ReportSchema.pick({
  title: true,
  stance: true,
  brief: true,
  thesis: true,
  metrics: true,
  charts: true,
  scenarios: true,
  risks: true,
  catalysts: true,
  limitations: true,
  asOf: true,
});
export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;
