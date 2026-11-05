import { describe, expect, it } from "vitest";
import { describeDocument, groupTrace, humanise, phaseOf, statusLine } from "@/lib/client/trace";
import type { TraceEntry } from "@/lib/client/history";

const t = (type: TraceEntry["type"], message: string, at = "2026-11-05T07:00:00.000Z"): TraceEntry => ({ type, message, at });

const trace: TraceEntry[] = [
  t("exec_status", "Starting research"),
  t("tool_call", "Listing tools for MCP server every."),
  t("plan", "I will read Tesla's latest filings and releases."),
  t("search", "Objective: Find Tesla's Q3 2026 10-Q risk disclosures."),
  t("search", "Query: Tesla Q3 2026 10-Q risk factors"),
  t("search", "Query: Tesla 10-Q September 30 2026"),
  t("extract", "Extract: https://www.sec.gov/Archives/edgar/data/1318605/000162828026066775/tsla-20260930.htm"),
  t("extract", "Extract: https://ir.tesla.com/_flysystem/s3/sec/000162828026003837/tsla-20260128-gen.pdf"),
  t("plan", "I have verified Q3 2026 revenue and FCF from official exhibits."),
];

describe("trace helpers", () => {
  it("humanises searches, documents and tool calls", () => {
    expect(humanise(t("search", "Query: x")).kind).toBe("query");
    expect(humanise(t("search", "Objective: Find X")).text).toBe("Looking for X");
    const d = humanise(trace[6]);
    expect(d.kind).toBe("read");
    expect(d.host).toBe("sec.gov");
    expect(d.text).toBe("TSLA filing, period ending Sep 2026");
    expect(d.url).toContain("https://www.sec.gov/");
    expect(humanise(trace[1]).text).toBe("Preparing research tools");
    expect(describeDocument("TSLA-Q3-2026-Update.pdf", "x")).toBe("TSLA Q3 2026 Update (PDF)");
  });

  it("groups consecutive steps and writes summaries", () => {
    const g = groupTrace(trace);
    expect(g.map((x) => x.kind)).toEqual(["status", "plan", "search", "read", "note"]);
    expect(g[2].objectives).toHaveLength(1);
    expect(g[2].queries).toHaveLength(2);
    expect(g[2].summary).toMatch(/^Ran 2 searches: Looking for Tesla/);
    expect(g[3].docs).toHaveLength(2);
    expect(g[3].summary).toBe("Read 2 documents from sec.gov, ir.tesla.com");
    expect(g[4].summary).toMatch(/^I have verified/);
    // duplicate documents collapse
    expect(groupTrace([...trace, trace[6]]).at(-1)?.kind).toBe("read");
  });

  it("phase never regresses on late plan notes", () => {
    expect(phaseOf(trace.slice(0, 3), "researching")).toBe("plan");
    expect(phaseOf(trace.slice(0, 5), "researching")).toBe("search");
    expect(phaseOf(trace, "researching")).toBe("read");
    expect(phaseOf(trace, "synthesizing")).toBe("write");
    expect(phaseOf(trace, "completed")).toBe("ready");
  });

  it("status line is short and reflects the current activity", () => {
    expect(statusLine(trace.slice(0, 5), "researching")).toBe("Searching: Tesla Q3 2026 10-Q risk factors");
    expect(statusLine(trace.slice(0, 7), "researching")).toBe("Reading sec.gov");
    expect(statusLine(trace, "researching")).toBe("Reviewing what has been found");
    expect(statusLine([], "queued")).toMatch(/Waiting/);
    expect(statusLine(trace, "synthesizing", "Writing the charts")).toBe("Writing the charts");
    expect(statusLine(trace.slice(0, 5), "researching").length).toBeLessThan(100);
  });
});
