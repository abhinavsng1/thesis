import { ReportSchema, type Report } from "@/lib/schema/report";
import { SAMPLE_REPORTS } from "@/fixtures";

const SAMPLE_PREFIX = "sample-";

export function isSampleId(id: string): boolean {
  return id.startsWith(SAMPLE_PREFIX);
}

export function listSamples(): Array<Pick<Report, "id" | "title" | "question" | "asOf" | "stats">> {
  return SAMPLE_REPORTS.map((r) => ({ id: r.id, title: r.title, question: r.question, asOf: r.asOf, stats: r.stats }));
}

export function getSampleReport(id: string): Report | null {
  const r = SAMPLE_REPORTS.find((x) => x.id === id);
  return r ? ReportSchema.parse(r) : null;
}
