import { describe, expect, it } from "vitest";
import { normalizeEvidence, canonicalUrl, classifySource, dedupePack } from "@/lib/research/evidence";
import type { ProviderResult } from "@/lib/research/provider";

const pack = {
  summary: "Microsoft grew.",
  facts: [
    { claim: "Revenue was $281.7bn in FY2025.", period: "FY2025", kind: "reported" },
    { claim: "Revenue was $281.7bn in FY2025.", period: "FY2025", kind: "reported" },
    { claim: "Capex guided over $50bn next quarter.", period: "Q2 FY27", kind: "guidance" },
  ],
  metrics: [
    { entity: "Microsoft", metric: "Revenue", period: "FY2025", value: 281.7, unit: "bn", currency: "USD", is_estimate: false },
    { entity: "Microsoft", metric: "Revenue", period: "FY2025", value: 281.7, unit: "bn", currency: "USD", is_estimate: false },
  ],
  risks: ["Capex", "Capex", " "],
  catalysts: [{ event: "Earnings", timing: "Late Jan" }],
  conflicts: [],
  missing: ["Share price"],
  as_of: "2026-10-28",
};

function result(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    run: { runId: "r", status: "completed" },
    output: { type: "json", content: pack },
    basis: [
      { field: "facts", citations: [{ url: "https://www.microsoft.com/en-us/investor/earnings/fy-2025-q4/press-release-webcast?utm_source=x#top", title: "FY25 Q4 release", excerpts: ["Revenue was $281.7 billion"] }] },
      { field: "facts.2", citations: [{ url: "https://www.microsoft.com/en-us/investor/events/fy-2027/earnings-fy-2027-q1", title: "Call", excerpts: ["over $50 billion"] }] },
      { field: "metrics.0", citations: [{ url: "https://www.microsoft.com/en-us/investor/earnings/fy-2025-q4/press-release-webcast", title: null, excerpts: null }] },
      { field: "risks", citations: [{ url: "javascript:alert(1)", title: "bad" }] },
    ],
    ...overrides,
  };
}

describe("normalizeEvidence", () => {
  it("dedupes sources by canonical URL, numbers them, and drops unsafe schemes", () => {
    const n = normalizeEvidence(result(), { retrievedAt: "2026-11-05T00:00:00.000Z", maxChars: 100_000 });
    expect(n.sources.map((s) => s.id)).toEqual(["S1", "S2"]);
    expect(n.sources[0].url).toBe("https://www.microsoft.com/en-us/investor/earnings/fy-2025-q4/press-release-webcast");
    expect(n.sources[0].title).toBe("FY25 Q4 release");
    expect(n.sources[0].kind).toBe("earnings_release");
    expect(n.sources[0].excerpts).toEqual(["Revenue was $281.7 billion"]);
  });
  it("tags facts with element-level citations when present, else parent-level", () => {
    const n = normalizeEvidence(result(), { retrievedAt: "2026-11-05T00:00:00.000Z", maxChars: 100_000 });
    expect(n.document).toContain("F1 | reported | FY2025 | Revenue was $281.7bn in FY2025. | [S1]");
    expect(n.document).toContain("Capex guided over $50bn next quarter. | [S2]");
    expect(n.pack?.facts).toHaveLength(2); // duplicate removed
    expect(n.pack?.metrics).toHaveLength(1);
    expect(n.pack?.risks).toEqual(["Capex"]);
  });
  it("bounds the document size and flags truncation", () => {
    const n = normalizeEvidence(result(), { retrievedAt: "2026-11-05T00:00:00.000Z", maxChars: 200 });
    expect(n.truncated).toBe(true);
    expect(n.document.length).toBeLessThan(300);
  });
  it("falls back to text output", () => {
    const n = normalizeEvidence(result({ output: { type: "text", content: "Notes…" } }), { retrievedAt: "2026-11-05T00:00:00.000Z", maxChars: 100_000 });
    expect(n.pack).toBeNull();
    expect(n.document).toContain("RESEARCH_NOTES:");
  });
  it("helpers", () => {
    expect(canonicalUrl("http://a.b/c/?utm_medium=1&x=2#frag")).toBe("http://a.b/c/?x=2");
    expect(canonicalUrl("ftp://a.b")).toBeNull();
    expect(classifySource("https://www.sec.gov/Archives/edgar/data/1/x.htm")).toBe("filing");
    expect(classifySource("https://www.reuters.com/x")).toBe("news");
    expect(dedupePack({ ...pack, kind: undefined } as never).facts.length).toBe(2);
  });
});
