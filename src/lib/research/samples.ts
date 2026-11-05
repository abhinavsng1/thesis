import { ReportSchema, type Report } from "@/lib/schema/report";
import { SAMPLE_REPORTS } from "@/fixtures";

const SAMPLE_PREFIX = "sample-";

export function isSampleId(id: string): boolean {
  return id.startsWith(SAMPLE_PREFIX);
}

export type SampleSummary = Pick<Report, "id" | "title" | "question" | "asOf" | "stats" | "stance"> & { sources: number; charts: number };

export function listSamples(): SampleSummary[] {
  return SAMPLE_REPORTS.map((r) => ({ id: r.id, title: r.title, question: r.question, asOf: r.asOf, stats: r.stats, stance: r.stance, sources: r.sources.length, charts: r.charts.length }));
}

export function getSampleReport(id: string): Report | null {
  const r = SAMPLE_REPORTS.find((x) => x.id === id);
  return r ? ReportSchema.parse(r) : null;
}
