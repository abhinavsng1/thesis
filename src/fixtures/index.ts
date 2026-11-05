import { ReportSchema, type Report } from "@/lib/schema/report";
import { computeStats } from "@/lib/report/stats";
import { sampleMicrosoft } from "./sample-microsoft";
import { sampleNvidiaAmd } from "./sample-nvidia-amd";

function finalize(r: Omit<Report, "stats">): Report {
  return ReportSchema.parse({ ...r, stats: computeStats(r) });
}

/** Clearly isolated sample reports. Served only for ids starting with "sample-". */
export const SAMPLE_REPORTS: Report[] = [finalize(sampleMicrosoft), finalize(sampleNvidiaAmd)];
