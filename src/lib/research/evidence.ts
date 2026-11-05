import type { ProviderBasis, ProviderResult } from "./provider";
import { EvidencePackSchema, type EvidencePack } from "./evidence-pack";
import { SourceKind } from "@/lib/schema/report";
import type { Source } from "@/lib/schema/report";
import { z } from "zod";

/**
 * Evidence normalization: turns a provider result into
 *  - a deduplicated, numbered source list (S1, S2, …) with excerpts, and
 *  - a compact, citation-tagged evidence document for the synthesis model.
 * Everything downstream references sources only by id.
 */

export interface NormalizedEvidence {
  sources: Source[];
  /** Evidence pack with each item annotated by the source ids that support it. */
  pack: EvidencePack | null;
  /** Provider text output, when no structured pack was returned. */
  text: string | null;
  /** Compact prompt-ready document (bounded by maxChars). */
  document: string;
  truncated: boolean;
}

export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    // strip common tracking params
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(k)) u.searchParams.delete(k);
    }
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function publisherFromUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return undefined;
  }
}

export function classifySource(url: string, title?: string | null): z.infer<typeof SourceKind> {
  const u = url.toLowerCase();
  const t = (title ?? "").toLowerCase();
  if (u.includes("sec.gov") || /10-k|10-q|20-f|8-k|annual report|form\s/.test(t)) return "filing";
  if (/earnings|results|quarter|fiscal/.test(t) || /earnings|results/.test(u)) return "earnings_release";
  if (/transcript|call/.test(t) || /transcript/.test(u)) return "transcript";
  if (/presentation|investor day|slides/.test(t)) return "presentation";
  if (/\.gov\b|\.gov\//.test(u) || /regulat|commission|authority/.test(t)) return "regulatory";
  if (/\bdata\b|statistics|dataset|bls\.gov|fred\./.test(u + " " + t)) return "dataset";
  if (/reuters|bloomberg|ft\.com|wsj|cnbc|news|barrons|marketwatch/.test(u)) return "news";
  return "other";
}

/** Maps a basis `field` like "metrics.3" to {collection, index}. Top-level fields map to index null. */
export function parseFieldPath(field: string): { root: string; index: number | null } {
  const [root, idx] = field.split(".");
  const n = idx === undefined ? NaN : Number(idx);
  return { root, index: Number.isInteger(n) ? n : null };
}

export function normalizeEvidence(
  result: ProviderResult,
  opts: { retrievedAt: string; maxChars: number },
): NormalizedEvidence {
  const sourceByUrl = new Map<string, Source>();
  const idsByField = new Map<string, string[]>();
  const order: string[] = [];

  const addCitation = (field: string, c: { url: string; title?: string | null; excerpts?: string[] | null }) => {
    const url = canonicalUrl(c.url);
    if (!url) return;
    let s = sourceByUrl.get(url);
    if (!s) {
      s = {
        id: `S${sourceByUrl.size + 1}`,
        title: (c.title ?? "").trim() || url,
        url,
        publisher: publisherFromUrl(url),
        retrievedAt: opts.retrievedAt,
        kind: classifySource(url, c.title),
        excerpts: [],
      };
      sourceByUrl.set(url, s);
      order.push(url);
    } else if (c.title && s.title === s.url) {
      s.title = c.title.trim();
    }
    for (const ex of c.excerpts ?? []) {
      const clean = ex.replace(/\s+/g, " ").trim().slice(0, 600);
      if (clean && s.excerpts.length < 6 && !s.excerpts.includes(clean)) s.excerpts.push(clean);
    }
    const list = idsByField.get(field) ?? [];
    if (!list.includes(s.id)) list.push(s.id);
    idsByField.set(field, list);
  };

  // Sort basis so parent fields come first; element-level entries override for precision.
  const basis: ProviderBasis[] = [...result.basis].sort((a, b) => a.field.length - b.field.length);
  for (const b of basis) for (const c of b.citations) addCitation(b.field, c);

  const sources = order.map((u) => sourceByUrl.get(u)!);

  const idsFor = (root: string, index: number): string[] => {
    const exact = idsByField.get(`${root}.${index}`);
    if (exact && exact.length) return exact;
    return idsByField.get(root) ?? [];
  };

  let pack: EvidencePack | null = null;
  let text: string | null = null;
  const lines: string[] = [];

  if (result.output.type === "json") {
    const parsed = EvidencePackSchema.safeParse(result.output.content);
    if (parsed.success) {
      const d = dedupePackIndexed(parsed.data);
      pack = d.pack;
      lines.push(`AS_OF: ${pack.as_of}`);
      lines.push(`SUMMARY: ${pack.summary}`);
      lines.push("", "FACTS (id | kind | period | claim | sources):");
      pack.facts.forEach((f, i) => lines.push(`F${i + 1} | ${f.kind} | ${f.period} | ${f.claim} | ${tag(idsFor("facts", d.facts[i]))}`));
      lines.push("", "METRICS (entity | metric | period | value unit currency | estimate? | sources):");
      pack.metrics.forEach((m, i) =>
        lines.push(`${m.entity} | ${m.metric} | ${m.period} | ${m.value} ${m.unit} ${m.currency} | ${m.is_estimate ? "estimate" : "reported"} | ${tag(idsFor("metrics", d.metrics[i]))}`),
      );
      lines.push("", "RISKS:");
      pack.risks.forEach((r, i) => lines.push(`- ${r} ${tag(idsFor("risks", d.risks[i]))}`));
      lines.push("", "CATALYSTS (event | timing | sources):");
      pack.catalysts.forEach((c, i) => lines.push(`- ${c.event} | ${c.timing} | ${tag(idsFor("catalysts", d.catalysts[i]))}`));
      if (pack.conflicts.length) {
        lines.push("", "CONFLICTS:");
        pack.conflicts.forEach((c) => lines.push(`- ${c}`));
      }
      if (pack.missing.length) {
        lines.push("", "MISSING:");
        pack.missing.forEach((m) => lines.push(`- ${m}`));
      }
    } else {
      text = JSON.stringify(result.output.content).slice(0, opts.maxChars);
      lines.push("RAW_EVIDENCE (provider returned JSON that did not match the requested schema):", text);
      lines.push(`SOURCES_FOR_ALL: ${tag(idsByField.get("output") ?? sources.map((s) => s.id))}`);
    }
  } else {
    text = result.output.content;
    lines.push("RESEARCH_NOTES:", text);
    lines.push("", `SOURCES_FOR_ALL: ${tag(idsByField.get("output") ?? sources.map((s) => s.id))}`);
  }

  lines.push("", "SOURCES:");
  for (const s of sources) {
    lines.push(`${s.id} | ${s.kind} | ${s.title} | ${s.publisher ?? ""} | ${s.url}`);
  }

  let document = lines.join("\n");
  let truncated = false;
  if (document.length > opts.maxChars) {
    document = `${document.slice(0, opts.maxChars)}\n…[evidence truncated to ${opts.maxChars} characters]`;
    truncated = true;
  }
  return { sources, pack, text, document, truncated };
}

function tag(ids: string[]): string {
  return ids.length ? ids.map((i) => `[${i}]`).join("") : "[unsourced]";
}

/** Removes exact and near-duplicate items so the synthesis prompt stays dense; returns kept original indexes so citations stay attached. */
export function dedupePackIndexed(pack: EvidencePack): { pack: EvidencePack; facts: number[]; metrics: number[]; risks: number[]; catalysts: number[] } {
  const keep = <T,>(items: T[], keyOf: (t: T) => string) => {
    const seen = new Set<string>();
    const idx: number[] = [];
    const out: T[] = [];
    items.forEach((it, i) => {
      const k = keyOf(it);
      if (!k || seen.has(k)) return;
      seen.add(k);
      idx.push(i);
      out.push(it);
    });
    return { out, idx };
  };
  const facts = keep(pack.facts, (f) => f.claim.toLowerCase().replace(/[^a-z0-9%.]+/g, " ").trim());
  const metrics = keep(pack.metrics, (m) => `${m.entity}|${m.metric}|${m.period}`.toLowerCase());
  const risks = keep(pack.risks, (r) => r.trim().toLowerCase());
  const catalysts = keep(pack.catalysts, (c) => `${c.event}|${c.timing}`.trim().toLowerCase());
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  return {
    pack: { ...pack, facts: facts.out, metrics: metrics.out, risks: risks.out.map((r) => r.trim()), catalysts: catalysts.out, conflicts: uniq(pack.conflicts), missing: uniq(pack.missing) },
    facts: facts.idx,
    metrics: metrics.idx,
    risks: risks.idx,
    catalysts: catalysts.idx,
  };
}

export function dedupePack(pack: EvidencePack): EvidencePack {
  return dedupePackIndexed(pack).pack;
}
