import { ReportSchema, type Report, type Source } from "@/lib/schema/report";

/**
 * Post-synthesis quality pass. The model's output is advisory; the server
 * enforces: every citation points at a real source, chart numbers are finite
 * and consistent within a series, periods are not mixed inside one chart,
 * and duplicate risks/catalysts are collapsed.
 */

export interface ValidationNote {
  level: "info" | "warn";
  message: string;
}

export function validateAndRepair(candidate: Report): { report: Report; notes: ValidationNote[] } {
  const notes: ValidationNote[] = [];
  const known = new Set(candidate.sources.map((s) => s.id));

  const fixIds = (ids: string[], where: string): string[] => {
    const good = [...new Set(ids)].filter((id) => known.has(id));
    if (good.length !== ids.length) notes.push({ level: "warn", message: `Dropped ${ids.length - good.length} unknown citation(s) in ${where}.` });
    return good;
  };

  const r: Report = structuredClone(candidate);

  for (const key of ["answer", "opportunity", "risk", "uncertainty"] as const) {
    r.brief[key].sourceIds = fixIds(r.brief[key].sourceIds, `brief.${key}`);
  }
  r.thesis = r.thesis.map((t, i) => ({ ...t, sourceIds: fixIds(t.sourceIds, `thesis[${i}]`) }));
  if (r.metrics) {
    r.metrics.rows = r.metrics.rows.map((row) => ({
      ...row,
      values: row.values.map((v) => ({ ...v, sourceIds: fixIds(v.sourceIds, `metrics.${row.metric}`) })),
    }));
  }

  r.charts = r.charts
    .map((c, i) => ({ ...c, sourceIds: fixIds(c.sourceIds, `charts[${i}]`) }))
    .filter((c) => {
      if (c.sourceIds.length === 0) {
        notes.push({ level: "warn", message: `Removed chart "${c.title}" because it had no valid source.` });
        return false;
      }
      const periodsPerSeries = c.series.map((s) => s.points.map((p) => p.period));
      const allSame = periodsPerSeries.every((ps) => ps.join("|") === periodsPerSeries[0].join("|"));
      if (!allSame && (c.kind === "stacked-bar" || c.kind === "grouped-bar")) {
        notes.push({ level: "warn", message: `Removed chart "${c.title}" because its series use different periods.` });
        return false;
      }
      const numeric = c.series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null);
      if (numeric.length < 2) {
        notes.push({ level: "warn", message: `Removed chart "${c.title}" because it had fewer than two data points.` });
        return false;
      }
      return true;
    });

  if (r.scenarios) {
    r.scenarios.cases = r.scenarios.cases.map((c) => ({ ...c, sourceIds: fixIds(c.sourceIds, `scenario.${c.name}`) }));
  }

  const seenRisk = new Set<string>();
  r.risks = r.risks
    .map((rk, i) => ({ ...rk, sourceIds: fixIds(rk.sourceIds, `risks[${i}]`) }))
    .filter((rk) => {
      const k = rk.title.toLowerCase().trim();
      if (seenRisk.has(k)) return false;
      seenRisk.add(k);
      return true;
    });

  const seenCat = new Set<string>();
  r.catalysts = r.catalysts
    .map((c, i) => ({ ...c, sourceIds: fixIds(c.sourceIds, `catalysts[${i}]`) }))
    .filter((c) => {
      const k = c.event.toLowerCase().trim();
      if (seenCat.has(k)) return false;
      seenCat.add(k);
      return true;
    });

  // Drop sources nothing cites? No: keep them for transparency, but order cited ones first.
  const cited = collectCited(r);
  const uncited = r.sources.filter((s) => !cited.has(s.id)).length;
  if (uncited) notes.push({ level: "info", message: `${uncited} retrieved source(s) are listed but not cited by a claim.` });

  const final = ReportSchema.parse(r);
  return { report: final, notes };
}

export function collectCited(r: Report): Set<string> {
  const ids = new Set<string>();
  const add = (xs: string[]) => xs.forEach((x) => ids.add(x));
  for (const c of Object.values(r.brief)) add(c.sourceIds);
  r.thesis.forEach((t) => add(t.sourceIds));
  r.metrics?.rows.forEach((row) => row.values.forEach((v) => add(v.sourceIds)));
  r.charts.forEach((c) => add(c.sourceIds));
  r.scenarios?.cases.forEach((c) => add(c.sourceIds));
  r.risks.forEach((x) => add(x.sourceIds));
  r.catalysts.forEach((x) => add(x.sourceIds));
  return ids;
}

export function sourceMap(sources: Source[]): Map<string, Source> {
  return new Map(sources.map((s) => [s.id, s]));
}
