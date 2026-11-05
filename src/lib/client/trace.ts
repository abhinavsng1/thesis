import type { TraceEntry } from "./history";

/**
 * Pure helpers that turn the provider's raw trace into something a reader
 * can follow: humanised steps, collapsible groups, a monotonic phase and a
 * short status line. Kept free of React so they can be unit-tested.
 */

export type Phase = "plan" | "search" | "read" | "write" | "ready";
export const PHASES: Array<{ id: Phase; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "search", label: "Search" },
  { id: "read", label: "Read" },
  { id: "write", label: "Write" },
  { id: "ready", label: "Ready" },
];

export interface Step {
  kind: "plan" | "objective" | "query" | "read" | "found" | "tool" | "status" | "error" | "note";
  text: string;
  url?: string;
  host?: string;
  at: string;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Turns "tsla-20260930.htm" into "TSLA filing, period ending Sep 2026" where the SEC pattern is recognisable; otherwise a readable file name. */
export function describeDocument(file: string, host: string): string {
  const sec = file.match(/^([a-z]{1,6})-(\d{4})(\d{2})(\d{2})/i);
  if (sec) {
    const month = new Date(Number(sec[2]), Number(sec[3]) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${sec[1].toUpperCase()} filing, period ending ${month} ${sec[2]}`;
  }
  if (/\.pdf$/i.test(file)) return file.replace(/[-_]+/g, " ").replace(/\.pdf$/i, "") + " (PDF)";
  if (/press-release|earnings/i.test(file)) return "Earnings release";
  const clean = decodeURIComponent(file).replace(/[-_]+/g, " ");
  return clean.length > 56 ? `${clean.slice(0, 54)}…` : clean || host;
}

export function humanise(t: TraceEntry): Step {
  const m = t.message.trim();
  if (t.type === "search") {
    const q = m.match(/^Query\s*:\s*(.*)$/i);
    if (q) return { kind: "query", text: q[1], at: t.at };
    const o = m.match(/^Objective\s*:\s*(.*)$/i);
    const text = (o ? o[1] : m).replace(/^Find\b/, "Looking for");
    return { kind: "objective", text, at: t.at };
  }
  if (t.type === "extract") {
    const u = m.match(/^Extract\s*:\s*(https?:\/\/\S+)$/i)?.[1];
    if (u) {
      const host = hostOf(u);
      let file = "";
      try {
        file = new URL(u).pathname.split("/").filter(Boolean).pop() ?? "";
      } catch {
        /* keep empty */
      }
      return { kind: "read", text: file ? describeDocument(file, host) : host, url: u, host, at: t.at };
    }
    return { kind: "read", text: m, at: t.at };
  }
  if (t.type === "tool_call") return { kind: "tool", text: /listing tools/i.test(m) ? "Preparing research tools" : m, at: t.at };
  if (t.type === "exec_status" || t.type === "status") return { kind: "status", text: m, at: t.at };
  if (t.type === "result") return { kind: "found", text: m, at: t.at };
  if (t.type === "error") return { kind: "error", text: m, at: t.at };
  // Plan messages: the first is the plan; later ones read as progress notes ("I have verified…").
  return { kind: "plan", text: m, at: t.at };
}

export interface Group {
  kind: "plan" | "search" | "read" | "note" | "status" | "error";
  at: string;
  /** One-line summary shown when collapsed. */
  summary: string;
  objectives: string[];
  queries: string[];
  docs: Step[];
  text?: string;
}

/** Groups consecutive related steps so a run reads as a handful of blocks rather than dozens of lines. */
export function groupTrace(trace: TraceEntry[]): Group[] {
  const groups: Group[] = [];
  let seenPlan = false;
  const push = (g: Group) => groups.push(g);
  const last = () => groups[groups.length - 1];
  for (const t of trace) {
    const s = humanise(t);
    switch (s.kind) {
      case "query": {
        const g = last();
        if (g?.kind === "search") g.queries.push(s.text);
        else push({ kind: "search", at: s.at, summary: "", objectives: [], queries: [s.text], docs: [] });
        break;
      }
      case "objective": {
        const g = last();
        if (g?.kind === "search") g.objectives.push(s.text);
        else push({ kind: "search", at: s.at, summary: "", objectives: [s.text], queries: [], docs: [] });
        break;
      }
      case "read": {
        const g = last();
        if (g?.kind === "read") {
          if (!g.docs.some((d) => d.url === s.url)) g.docs.push(s);
        } else push({ kind: "read", at: s.at, summary: "", objectives: [], queries: [], docs: [s] });
        break;
      }
      case "plan": {
        if (!seenPlan) {
          seenPlan = true;
          push({ kind: "plan", at: s.at, summary: "", objectives: [], queries: [], docs: [], text: s.text });
        } else push({ kind: "note", at: s.at, summary: "", objectives: [], queries: [], docs: [], text: s.text });
        break;
      }
      case "found":
        push({ kind: "note", at: s.at, summary: "", objectives: [], queries: [], docs: [], text: s.text });
        break;
      case "error":
        push({ kind: "error", at: s.at, summary: "", objectives: [], queries: [], docs: [], text: s.text });
        break;
      default: {
        const g = last();
        if (g?.kind === "status") g.text = `${g.text} · ${s.text}`;
        else push({ kind: "status", at: s.at, summary: "", objectives: [], queries: [], docs: [], text: s.text });
      }
    }
  }
  for (const g of groups) g.summary = summarise(g);
  return groups;
}

function summarise(g: Group): string {
  switch (g.kind) {
    case "plan":
      return "Planned the research";
    case "search": {
      const n = g.queries.length;
      const o = g.objectives[0];
      const base = n === 0 ? "Searching" : `Ran ${n} ${n === 1 ? "search" : "searches"}`;
      return o ? `${base}: ${truncate(o, 90)}` : base;
    }
    case "read": {
      const hosts = [...new Set(g.docs.map((d) => d.host).filter(Boolean))];
      return `Read ${g.docs.length} ${g.docs.length === 1 ? "document" : "documents"}${hosts.length ? ` from ${hosts.slice(0, 3).join(", ")}${hosts.length > 3 ? ` +${hosts.length - 3}` : ""}` : ""}`;
    }
    case "note":
      return truncate(g.text ?? "", 110);
    case "status":
      return g.text ?? "";
    case "error":
      return g.text ?? "Error";
  }
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Highest phase reached. Never regresses when a late plan note arrives. */
export function phaseOf(trace: TraceEntry[], status: string): Phase {
  if (status === "completed") return "ready";
  if (status === "synthesizing") return "write";
  let phase: Phase = "plan";
  for (const t of trace) {
    if (t.type === "extract" || t.type === "result") phase = "read";
    else if (t.type === "search" && phase === "plan") phase = "search";
  }
  return phase;
}

/** Short, current-activity status line (not a raw message). */
export function statusLine(trace: TraceEntry[], status: string, writing?: string): string {
  if (status === "queued") return "Waiting for the research agent to start";
  if (status === "synthesizing") return writing ?? "Writing the report";
  const last = trace[trace.length - 1];
  if (!last) return "Starting research";
  const s = humanise(last);
  switch (s.kind) {
    case "query":
      return `Searching: ${truncate(s.text, 80)}`;
    case "objective":
      return truncate(s.text, 90);
    case "read":
      return `Reading ${s.host ?? "a source"}`;
    case "plan":
      return trace.filter((t) => t.type === "plan").length > 1 ? "Reviewing what has been found" : "Planning the research";
    case "found":
      return "Recording findings";
    case "tool":
    case "status":
      return s.text;
    case "error":
      return "The provider reported a problem";
    default:
      return s.text;
  }
}
