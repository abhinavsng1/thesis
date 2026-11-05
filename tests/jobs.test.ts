import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderResult, ProviderRun, ResearchProvider } from "@/lib/research/provider";
import { ProviderError } from "@/lib/research/provider";

vi.mock("@/lib/research/synthesis", () => ({
  SynthesisError: class SynthesisError extends Error {
    constructor(message: string, public readonly retryable: boolean) { super(message); }
  },
  synthesizeReport: vi.fn(async () => ({
    output: {
      title: "T", stance: "S", asOf: "2026-10-28",
      brief: { answer: { text: "a", kind: "reported", sourceIds: ["S1"] }, opportunity: { text: "o", kind: "inference", sourceIds: [] }, risk: { text: "r", kind: "inference", sourceIds: ["S9"] }, uncertainty: { text: "u", kind: "inference", sourceIds: [] } },
      thesis: [ { claim: "c1", evidence: "e", implication: "i", kind: "reported", sourceIds: ["S1"] }, { claim: "c2", evidence: "e", implication: "i", kind: "inference", sourceIds: [] } ],
      charts: [],
      risks: [{ title: "x", detail: "d", kind: "execution", sourceIds: [] }],
      catalysts: [],
      limitations: { missing: [], uncertainties: [], conflicts: [] },
    },
    usage: { model: "m", inputTokens: 10, outputTokens: 5 },
  })),
}));

import { _setProviderForTests, createJob, getJobStatus, getJobReport, JobError } from "@/lib/research/jobs";

class FakeProvider implements ResearchProvider {
  name = "fake";
  status: ProviderRun["status"] = "queued";
  created = 0;
  resultCalls = 0;
  processorFor(d: "quick" | "deep") { return d === "deep" ? "pro" : "core"; }
  listPriceUsd() { return 0.025; }
  async createRun(): Promise<ProviderRun> { this.created += 1; return { runId: `run_${this.created}`, status: "queued", processor: "core", createdAt: "2026-11-05T00:00:00.000Z" }; }
  async getRun(runId: string): Promise<ProviderRun> { return { runId, status: this.status, errorMessage: this.status === "failed" ? "provider failed" : undefined }; }
  async getResult(runId: string): Promise<ProviderResult> {
    this.resultCalls += 1;
    return { run: { runId, status: "completed", processor: "core" }, output: { type: "text", content: "notes" }, basis: [{ field: "output", citations: [{ url: "https://x.example/a", title: "A" }] }] };
  }
}

describe("job lifecycle", () => {
  let p: FakeProvider;
  beforeEach(() => { p = new FakeProvider(); _setProviderForTests(p); });

  it("creates once per idempotency key", async () => {
    const a = await createJob({ question: "Q long enough?", depth: "quick", budgetWords: 1000 }, "k1");
    const b = await createJob({ question: "Q long enough?", depth: "quick", budgetWords: 1000 }, "k1");
    expect(a.id).toBe(b.id);
    expect(b.reused).toBe(true);
    expect(p.created).toBe(1);
    const c = await createJob({ question: "Q long enough?", depth: "quick", budgetWords: 1000 }, "k2");
    expect(c.id).not.toBe(a.id);
  });

  it("maps provider status to observable job states, including failures", async () => {
    const job = await createJob({ question: "Q long enough?", depth: "quick", budgetWords: 1000 });
    p.status = "queued"; expect((await getJobStatus(job.id)).status).toBe("queued");
    p.status = "running"; expect((await getJobStatus(job.id)).status).toBe("researching");
    p.status = "action_required"; const s = await getJobStatus(job.id); expect(s.status).toBe("failed"); expect(s.error).toMatch(/manual action/);
    p.status = "failed"; expect((await getJobStatus(job.id)).error).toBe("provider failed");
    p.status = "cancelled"; expect((await getJobStatus(job.id)).status).toBe("cancelled");
  });

  it("synthesizes once and caches; concurrent calls share one synthesis", async () => {
    const job = await createJob({ question: "Q long enough?", depth: "quick", budgetWords: 1000 });
    p.status = "completed";
    const [r1, r2] = await Promise.all([getJobReport(job.id), getJobReport(job.id)]);
    expect(r1.report.id).toBe(job.id);
    expect(r1.report.sources[0].id).toBe("S1");
    expect(r1.report.brief.risk.sourceIds).toEqual([]); // S9 was unknown → dropped
    expect(r1.report.usage?.synthesis?.model).toBe("m");
    expect(r1.report.usage?.provider?.listPriceUsd).toBe(0.025);
    expect(r2.report).toEqual(r1.report);
    expect(p.resultCalls).toBe(1);
    expect((await getJobStatus(job.id)).status).toBe("completed");
  });

  it("needs the question on a cold instance and accepts a hint", async () => {
    p.status = "completed";
    await expect(getJobReport("run_unknown")).rejects.toMatchObject({ status: 400 });
    const r = await getJobReport("run_unknown", { question: "Hinted question here" });
    expect(r.report.question).toBe("Hinted question here");
  });

  it("serves sample reports without a provider", async () => {
    _setProviderForTests(null);
    const s = await getJobStatus("sample-microsoft");
    expect(s.status).toBe("completed");
    const r = await getJobReport("sample-microsoft");
    expect(r.report.mode).toBe("sample");
    await expect(getJobReport("sample-nope")).rejects.toBeInstanceOf(JobError);
  });

  it("translates provider errors into JobErrors with HTTP statuses", async () => {
    p.getRun = async () => { throw new ProviderError("rate", "rate_limited", true, 429); };
    const err = await getJobStatus("run_x").catch((e) => e);
    expect(err).toBeInstanceOf(JobError);
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
  });
});
