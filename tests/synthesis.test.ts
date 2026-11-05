import { describe, expect, it } from "vitest";
import { coerceWire, extractJson, SynthesisWireSchema } from "@/lib/research/synthesis";

const wire = {
  title: "T".repeat(300),
  stance: "S",
  asOf: "2026-10-28",
  brief: {
    answer: { text: "Answer: Growth is accelerating.", kind: "reported", sourceIds: ["S1", "s1", "S2"] },
    opportunity: { text: "o", kind: "inference", sourceIds: [] },
    risk: { text: "r", kind: "inference", sourceIds: [] },
    uncertainty: { text: "u", kind: "inference", sourceIds: [] },
  },
  thesis: Array.from({ length: 7 }, (_, i) => ({ claim: `c${i}`, evidence: "e", implication: "i", kind: "reported", sourceIds: ["S1"] })),
  metrics: null,
  charts: [{ id: "", kind: "bar", title: "x", unit: "", currency: null, periodNote: null, series: [{ name: "a", isForecast: false, isDownside: false, points: [{ period: "FY1", value: 1 }, { period: "FY2", value: 2 }] }], takeaway: "t", sourceIds: ["S1"] }],
  scenarios: null,
  risks: [{ title: "r", detail: "d", kind: "execution", sourceIds: [] }],
  catalysts: [{ event: "e", timing: "", watch: null, sourceIds: [] }],
  limitations: { missing: [], uncertainties: [], conflicts: [] },
};

describe("synthesis wire handling", () => {
  it("extracts JSON from fenced or prose-wrapped text", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":[1,2]} thanks')).toEqual({ a: [1, 2] });
    expect(() => extractJson("no json")).toThrow();
  });
  it("coerces an unconstrained wire object into the strict report schema", () => {
    expect(SynthesisWireSchema.safeParse(wire).success).toBe(true);
    const out = coerceWire(SynthesisWireSchema.parse(wire));
    expect(out.title.length).toBeLessThanOrEqual(140);
    expect(out.thesis).toHaveLength(5);
    expect(out.brief.answer.text).toBe("Growth is accelerating.");
    expect(out.brief.answer.sourceIds).toEqual(["S1", "S2"]);
    expect(out.charts[0].id).toBe("chart-1");
    expect(out.charts[0].unit).toBe("n/a");
    expect(out.catalysts[0].timing).toBe("not disclosed");
    expect(out.metrics).toBeUndefined();
    expect(out.scenarios).toBeUndefined();
  });
});
