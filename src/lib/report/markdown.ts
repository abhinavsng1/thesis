import type { Report, Source } from "@/lib/schema/report";
import { HORIZON_LABELS, type Horizon } from "@/lib/schema/request";

/** Renders a report to portable Markdown with numbered citations. */
export function reportToMarkdown(r: Report): string {
  const cite = (ids: string[]) => (ids.length ? " " + ids.map((i) => `[${i.slice(1)}]`).join("") : "");
  const lines: string[] = [];
  lines.push(`# ${r.title}`);
  lines.push("");
  lines.push(`*${r.stance}*`);
  lines.push("");
  lines.push(`**Question.** ${r.question}  `);
  lines.push(`**As of.** ${r.asOf} · **Depth.** ${r.depth}${r.horizon ? ` · **Horizon.** ${HORIZON_LABELS[r.horizon as Horizon] ?? r.horizon}` : ""} · **Mode.** ${r.mode}`);
  if (r.sampleNotice) lines.push("", `> ${r.sampleNotice}`);
  lines.push("", "## Executive brief", "");
  lines.push(`**Answer.** ${r.brief.answer.text}${cite(r.brief.answer.sourceIds)}`, "");
  lines.push(`**Opportunity.** ${r.brief.opportunity.text}${cite(r.brief.opportunity.sourceIds)}`, "");
  lines.push(`**Risk.** ${r.brief.risk.text}${cite(r.brief.risk.sourceIds)}`, "");
  lines.push(`**Key uncertainty.** ${r.brief.uncertainty.text}${cite(r.brief.uncertainty.sourceIds)}`, "");
  lines.push("## Investment thesis", "");
  r.thesis.forEach((t, i) => {
    lines.push(`${i + 1}. **${t.claim}**${cite(t.sourceIds)}  `);
    lines.push(`   Evidence: ${t.evidence}  `);
    lines.push(`   Implication: ${t.implication}`);
  });
  if (r.metrics) {
    lines.push("", `## ${r.metrics.title}`, "");
    const periods = [...new Set(r.metrics.rows.flatMap((row) => row.values.map((v) => v.period)))];
    const header = ["Metric", "Unit", ...periods];
    lines.push(`| ${header.join(" | ")} |`);
    lines.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (const row of r.metrics.rows) {
      const cells = periods.map((p) => {
        const v = row.values.find((x) => x.period === p);
        if (!v || v.value === null) return "—";
        return `${formatNumber(v.value)}${v.isEstimate ? "E" : ""}${cite(v.sourceIds)}`;
      });
      lines.push(`| ${row.entity ? `${row.entity}: ` : ""}${row.metric} | ${row.unit} | ${cells.join(" | ")} |`);
    }
    const notes = [r.metrics.currency ? `Currency: ${r.metrics.currency}.` : "", r.metrics.periodNote ?? "", "E = estimate or guidance."].filter(Boolean);
    lines.push("", notes.join(" "));
  }
  if (r.charts.length) {
    lines.push("", "## Financial visuals", "");
    for (const c of r.charts) {
      lines.push(`### ${c.title}`, "");
      lines.push(`${c.takeaway}${cite(c.sourceIds)}`, "");
      const periods = c.series[0].points.map((p) => p.period);
      lines.push(`| Period | ${c.series.map((s) => `${s.name}${s.isForecast ? " (forecast)" : ""}`).join(" | ")} |`);
      lines.push(`| --- | ${c.series.map(() => "---").join(" | ")} |`);
      periods.forEach((p, i) => {
        lines.push(`| ${p} | ${c.series.map((s) => (s.points[i]?.value ?? null) === null ? "—" : formatNumber(s.points[i].value as number)).join(" | ")} |`);
      });
      lines.push("", `Unit: ${c.currency ? `${c.currency} ` : ""}${c.unit}.${c.periodNote ? ` ${c.periodNote}` : ""}`, "");
    }
  }
  if (r.scenarios) {
    lines.push("## Valuation and scenarios", "", r.scenarios.methodology, "");
    for (const c of r.scenarios.cases) {
      lines.push(`**${capitalize(c.name)} case.** ${c.summary}${cite(c.sourceIds)}  `);
      lines.push(`Assumptions: ${c.assumptions.join("; ")}.  `);
      lines.push(`Outcome: ${c.outcome}`, "");
    }
    if (r.scenarios.sensitivity) {
      const s = r.scenarios.sensitivity;
      lines.push(`Sensitivity to ${s.variable}:`, "");
      lines.push(`| | ${s.columns.join(" | ")} |`);
      lines.push(`| --- | ${s.columns.map(() => "---").join(" | ")} |`);
      s.rows.forEach((row) => lines.push(`| ${row.label} | ${row.values.join(" | ")} |`));
      if (s.note) lines.push("", s.note);
      lines.push("");
    }
    if (r.scenarios.caveat) lines.push(`> ${r.scenarios.caveat}`, "");
  }
  lines.push("## Risks and counterarguments", "");
  for (const rk of r.risks) lines.push(`- **${rk.title}** (${RISK_LABEL[rk.kind]}). ${rk.detail}${cite(rk.sourceIds)}`);
  if (r.catalysts.length) {
    lines.push("", "## Catalysts and monitoring", "");
    for (const c of r.catalysts) lines.push(`- **${c.event}** — ${c.timing}.${c.watch ? ` Watch: ${c.watch}.` : ""}${cite(c.sourceIds)}`);
  }
  lines.push("", "## Sources and limitations", "");
  lines.push(`Research cutoff: ${r.researchCutoff}`, "");
  if (r.limitations.missing.length) lines.push("Missing data:", ...r.limitations.missing.map((m) => `- ${m}`), "");
  if (r.limitations.uncertainties.length) lines.push("Material uncertainty:", ...r.limitations.uncertainties.map((m) => `- ${m}`), "");
  if (r.limitations.conflicts.length) lines.push("Conflicting evidence:", ...r.limitations.conflicts.map((m) => `- ${m}`), "");
  lines.push("Sources:", "");
  r.sources.forEach((s) => lines.push(`${s.id.slice(1)}. ${sourceLine(s)}`));
  lines.push("", `_${r.stats.wordCount} words · about ${r.stats.readingMinutes} min read. Generated by Thesis on ${r.completedAt.slice(0, 10)}._`);
  return lines.join("\n");
}

const RISK_LABEL: Record<Report["risks"][number]["kind"], string> = {
  evidence_against: "evidence against",
  execution: "execution",
  financial: "financial",
  invalidator: "would invalidate the thesis",
};

function sourceLine(s: Source): string {
  const meta = [s.publisher, s.publishedAt, s.period].filter(Boolean).join(", ");
  return `[${s.title}](${s.url})${meta ? ` — ${meta}` : ""}`;
}

/** Keeps the precision the source gave (up to 2 decimals) and adds thousands separators. */
export function formatNumber(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  const decimals = Math.min(2, (String(v).split(".")[1] ?? "").length);
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
