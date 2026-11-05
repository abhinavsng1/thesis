import { z } from "zod";

export const Depth = z.enum(["quick", "deep"]);
export type Depth = z.infer<typeof Depth>;

export const Horizon = z.enum(["6m", "1y", "3y", "5y+"]);
export type Horizon = z.infer<typeof Horizon>;

export const HORIZON_LABELS: Record<Horizon, string> = {
  "6m": "Next 6 months",
  "1y": "Next 12 months",
  "3y": "Next 3 years",
  "5y+": "5 years and beyond",
};

export const ResearchRequestSchema = z.object({
  question: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(12, "Ask a fuller question (at least 12 characters).").max(600, "Keep the question under 600 characters.")),
  depth: Depth.default("quick"),
  horizon: Horizon.optional(),
  /** Target length of the full report in words. */
  budgetWords: z.number().int().min(400).max(2000).default(1000),
});
export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;
export type ResearchRequestInput = z.input<typeof ResearchRequestSchema>;

/** Observable job states. "synthesizing" is a real server stage (report synthesis after the provider completes). */
export const JobStatus = z.enum([
  "queued",
  "researching",
  "synthesizing",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const ActivityEventSchema = z.object({
  at: z.string().datetime(),
  type: z.string(),
  message: z.string(),
  detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const JobStatusResponseSchema = z.object({
  id: z.string(),
  status: JobStatus,
  providerStatus: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  error: z.string().optional(),
  retryable: z.boolean().optional(),
  events: z.array(ActivityEventSchema).default([]),
});
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;
