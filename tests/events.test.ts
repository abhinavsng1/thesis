import { describe, expect, it } from "vitest";
import { normalizeParallelEvent, sseToProviderEvents } from "@/lib/research/parallel";

describe("provider event normalization", () => {
  it("maps documented Parallel events to normalized ones and drops unknown types", () => {
    expect(normalizeParallelEvent({ type: "task_run.progress_msg.search", message: "Query: Microsoft FY2026 10-K", timestamp: "2026-11-05T07:00:00Z" })).toEqual({ type: "search", message: "Query: Microsoft FY2026 10-K", timestamp: "2026-11-05T07:00:00Z" });
    expect(normalizeParallelEvent({ type: "task_run.progress_msg.plan", message: "I will read filings." })).toMatchObject({ type: "plan" });
    expect(normalizeParallelEvent({ type: "task_run.state", run: { status: "running" } })).toEqual({ type: "status", status: "running", timestamp: undefined });
    expect(normalizeParallelEvent({ type: "task_run.progress_stats", source_stats: { num_sources_considered: 10, num_sources_read: 3, sources_read_sample: ["https://a.example/x", "javascript:alert(1)"] }, progress_meter: 150 })).toEqual({ type: "stats", stats: { considered: 10, read: 3, sample: ["https://a.example/x"], progress: 100 } });
    expect(normalizeParallelEvent({ type: "error", error: { message: "boom" } })).toEqual({ type: "error", message: "boom" });
    expect(normalizeParallelEvent({ type: "task_run.progress_msg.unknown", message: "x" })).toBeNull();
    expect(normalizeParallelEvent({ type: "something.else" })).toBeNull();
  });

  it("parses an SSE byte stream, including split chunks, and emits end on close", async () => {
    const text = 'event: task_run.state\ndata: {"type":"task_run.state","run":{"status":"running"}}\n\nevent: task_run.progress_msg.search\ndata: {"type":"task_run.progress_msg.search","message":"Query: q1","timestamp":"t"}\n\n';
    const parts = [text.slice(0, 40), text.slice(40, 90), text.slice(90)];
    const rs = new ReadableStream<string>({
      start(c) {
        parts.forEach((p) => c.enqueue(p));
        c.close();
      },
    });
    const out: unknown[] = [];
    const reader = rs.pipeThrough(sseToProviderEvents()).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value);
    }
    expect(out).toEqual([
      { type: "status", status: "running", timestamp: undefined },
      { type: "search", message: "Query: q1", timestamp: "t" },
      { type: "end" },
    ]);
  });
});
