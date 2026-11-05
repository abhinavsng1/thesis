import { describe, expect, it } from "vitest";
import { ParallelProvider, buildResearchInput } from "@/lib/research/parallel";
import { ProviderError } from "@/lib/research/provider";

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body?: unknown }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const r = handler(u, init);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const opts = { apiKey: "test-key", baseUrl: "https://api.example", processorQuick: "core", processorDeep: "pro" };

describe("ParallelProvider", () => {
  it("creates a run with the documented endpoint, auth header and JSON schema", async () => {
    const { f, calls } = mockFetch(() => ({ status: 202, body: { run_id: "trun_1", status: "queued", is_active: true, processor: "pro", created_at: "2026-11-05T00:00:00Z", modified_at: "2026-11-05T00:00:00Z" } }));
    const p = new ParallelProvider({ ...opts, fetchImpl: f });
    const run = await p.createRun({ question: "Compare Nvidia and AMD", depth: "deep", clientKey: "abc" });
    expect(run).toMatchObject({ runId: "trun_1", status: "queued", processor: "pro" });
    expect(calls[0].url).toBe("https://api.example/v1/tasks/runs");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.processor).toBe("pro");
    expect(body.task_spec.output_schema.type).toBe("json");
    expect(body.task_spec.output_schema.json_schema.properties.metrics).toBeDefined();
    expect(body.metadata.client_key).toBe("abc");
    expect(body.input).toContain("Compare Nvidia and AMD");
  });

  it("maps provider statuses", async () => {
    for (const [provider, expected] of [["running", "running"], ["cancelling", "cancelled"], ["action_required", "action_required"], ["failed", "failed"]] as const) {
      const { f } = mockFetch(() => ({ status: 200, body: { run_id: "r", status: provider, error: provider === "failed" ? { message: "boom" } : null } }));
      const p = new ParallelProvider({ ...opts, fetchImpl: f });
      const run = await p.getRun("r");
      expect(run.status).toBe(expected);
      if (provider === "failed") expect(run.errorMessage).toBe("boom");
    }
  });

  it("maps HTTP errors to typed ProviderErrors without leaking payloads", async () => {
    const cases: Array<[number, string, boolean]> = [[401, "unauthorized", false], [402, "payment_required", false], [408, "timeout", true], [429, "rate_limited", true], [503, "upstream", true], [422, "invalid_request", false]];
    for (const [status, code, retryable] of cases) {
      const { f } = mockFetch(() => ({ status, body: { type: "error", error: { ref_id: "x", message: "internal detail " + "y".repeat(500) } } }));
      const p = new ParallelProvider({ ...opts, fetchImpl: f });
      const err = await p.getRun("r").catch((e) => e);
      expect(err).toBeInstanceOf(ProviderError);
      expect(err.code).toBe(code);
      expect(err.retryable).toBe(retryable);
      expect(err.message.length).toBeLessThan(300);
    }
  });

  it("rejects malformed responses", async () => {
    const { f } = mockFetch(() => ({ status: 200, body: { nope: true } }));
    const p = new ParallelProvider({ ...opts, fetchImpl: f });
    await expect(p.getRun("r")).rejects.toMatchObject({ code: "malformed" });
  });

  it("parses a JSON result with basis citations", async () => {
    const { f, calls } = mockFetch(() => ({
      status: 200,
      body: {
        run: { run_id: "r", status: "completed", processor: "core" },
        output: {
          type: "json",
          content: { summary: "s" },
          basis: [{ field: "summary", citations: [{ url: "https://a.example/x", title: "A", excerpts: ["e1"] }], reasoning: "r", confidence: "high" }],
        },
      },
    }));
    const p = new ParallelProvider({ ...opts, fetchImpl: f });
    const res = await p.getResult("r");
    expect(calls[0].url).toBe("https://api.example/v1/tasks/runs/r/result?timeout=1");
    expect(res.output.type).toBe("json");
    expect(res.basis[0].citations[0].url).toBe("https://a.example/x");
    expect(p.listPriceUsd("core")).toBeCloseTo(0.025);
    expect(p.listPriceUsd("unknown")).toBeUndefined();
  });

  it("builds a research prompt that states the horizon and sourcing rules", () => {
    const text = buildResearchInput({ question: "Q", depth: "quick", horizon: "3y" });
    expect(text).toContain("Next 3 years");
    expect(text).toContain("primary sources");
  });
});
