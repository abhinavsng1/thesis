import type { Report } from "@/lib/schema/report";

/** Word count of the human-readable report text (not tokens). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

export function reportText(r: Omit<Report, "stats">): string {
  const parts: string[] = [r.title, r.stance];
  for (const c of Object.values(r.brief)) parts.push(c.text);
  for (const t of r.thesis) parts.push(t.claim, t.evidence, t.implication);
  for (const ch of r.charts) parts.push(ch.takeaway);
  if (r.scenarios) {
    parts.push(r.scenarios.methodology);
    for (const c of r.scenarios.cases) parts.push(c.summary, c.outcome, ...c.assumptions);
    if (r.scenarios.caveat) parts.push(r.scenarios.caveat);
  }
  for (const rk of r.risks) parts.push(rk.title, rk.detail);
  for (const c of r.catalysts) parts.push(c.event, c.watch ?? "");
  parts.push(...r.limitations.missing, ...r.limitations.uncertainties, ...r.limitations.conflicts);
  return parts.join("\n");
}

export function computeStats(r: Omit<Report, "stats">): Report["stats"] {
  const wordCount = countWords(reportText(r));
  return { wordCount, readingMinutes: Math.max(1, Math.round(wordCount / 230)) };
}
