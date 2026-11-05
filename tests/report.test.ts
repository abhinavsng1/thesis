import { describe, expect, it } from "vitest";
import { SAMPLE_REPORTS } from "@/fixtures";
import { ReportSchema } from "@/lib/schema/report";
import { validateAndRepair, collectCited } from "@/lib/report/validate";
import { reportToMarkdown, formatNumber } from "@/lib/report/markdown";
import { computeStats } from "@/lib/report/stats";

describe("sample reports", () => {
  it("validate against the schema and cite only known sources", () => {
    for (const r of SAMPLE_REPORTS) {
      expect(ReportSchema.safeParse(r).success).toBe(true);
      const known = new Set(r.sources.map((s) => s.id));
      for (const id of collectCited(r)) expect(known.has(id)).toBe(true);
      expect(r.mode).toBe("sample");
      expect(r.sampleNotice).toBeTruthy();
      expect(r.stats.wordCount).toBeGreaterThan(500);
    }
  });
  it("chart series inside grouped charts share periods", () => {
    for (const r of SAMPLE_REPORTS) for (const c of r.charts) if (c.kind === "grouped-bar" || c.kind === "stacked-bar") {
      const first = c.series[0].points.map((p) => p.period).join("|");
      for (const s of c.series) expect(s.points.map((p) => p.period).join("|")).toBe(first);
    }
  });
});

describe("validateAndRepair", () => {
  it("drops unknown citations and charts without valid sources", () => {
    const base = SAMPLE_REPORTS[0];
    const broken = structuredClone(base);
    broken.thesis[0].sourceIds = ["S1", "S99"];
    broken.charts[0].sourceIds = ["S98"];
    broken.risks.push({ ...broken.risks[0] });
    const { report, notes } = validateAndRepair(broken);
    expect(report.thesis[0].sourceIds).toEqual(["S1"]);
    expect(report.charts.length).toBe(base.charts.length - 1);
    expect(report.risks.length).toBe(base.risks.length);
    expect(notes.some((n) => n.message.includes("unknown citation"))).toBe(true);
  });
});

describe("markdown export", () => {
  it("renders headings, tables, citations and sources", () => {
    const md = reportToMarkdown(SAMPLE_REPORTS[0]);
    expect(md).toContain("# Microsoft");
    expect(md).toContain("## Executive brief");
    expect(md).toContain("| Metric | Unit |");
    expect(md).toMatch(/\[\d+\]/);
    expect(md).toContain("https://www.microsoft.com/en-us/investor/earnings/fy-2026-q4/press-release-webcast");
    expect(md).toContain("## Sources and limitations");
  });
  it("formats numbers compactly", () => {
    expect(formatNumber(281.7)).toBe("281.7");
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(9.68)).toBe("9.68");
  });
  it("stats are word counts, not tokens", () => {
    const { stats, ...rest } = SAMPLE_REPORTS[0];
    expect(computeStats(rest)).toEqual(stats);
  });
});

describe("chart helpers", () => {
  it("niceScale produces rounded bounds and ticks", async () => {
    const { niceScale } = await import("@/components/report/ChartFigure");
    expect(niceScale([206, 145, 100])).toEqual({ domain: [0, 250], ticks: [0, 50, 100, 150, 200, 250] });
    expect(niceScale([43, 33]).domain[1]).toBe(50);
    expect(niceScale([-5, 10]).domain[0]).toBeLessThan(0);
  });
  it("chartRows aligns series by the union of periods", async () => {
    const { chartRows } = await import("@/components/report/ChartFigure");
    const rows = chartRows(SAMPLE_REPORTS[0].charts[3]);
    expect(rows.map((r) => r.period)).toContain("Q2 FY27");
    expect(rows.find((r) => r.period === "Q2 FY27")?.s1).toBe(50);
  });
});
