import { describe, expect, it } from "vitest";
import { ResearchRequestSchema } from "@/lib/schema/request";

describe("ResearchRequestSchema", () => {
  it("accepts a normal question with defaults", () => {
    const r = ResearchRequestSchema.parse({ question: "What is the investment thesis for Microsoft?" });
    expect(r.depth).toBe("quick");
    expect(r.budgetWords).toBe(1000);
    expect(r.horizon).toBeUndefined();
  });
  it("normalizes whitespace", () => {
    const r = ResearchRequestSchema.parse({ question: "  Compare   Nvidia\n and AMD   on growth " });
    expect(r.question).toBe("Compare Nvidia and AMD on growth");
  });
  it("rejects short, long, and invalid inputs", () => {
    expect(ResearchRequestSchema.safeParse({ question: "MSFT?" }).success).toBe(false);
    expect(ResearchRequestSchema.safeParse({ question: "x".repeat(601) }).success).toBe(false);
    expect(ResearchRequestSchema.safeParse({ question: "Is Apple a good buy right now?", depth: "ultra" }).success).toBe(false);
    expect(ResearchRequestSchema.safeParse({ question: "Is Apple a good buy right now?", budgetWords: 50 }).success).toBe(false);
  });
});
