import type { Report } from "@/lib/schema/report";
import type { ActivityEvent, Depth, Horizon, JobStatus } from "@/lib/schema/request";

/**
 * Recent research lives in the browser's localStorage only. Nothing is sent
 * to a server for storage. Storage may be unavailable (private mode, quota);
 * every call degrades to an in-memory fallback and reports availability.
 */

/** One observable step from the provider's live progress stream. */
export interface TraceEntry {
  at: string;
  type: "plan" | "search" | "result" | "tool_call" | "exec_status" | "extract" | "status" | "error";
  message: string;
}

export interface TraceStats {
  considered: number;
  read: number;
  sample: string[];
  progress: number | null;
  at: string;
}

export interface HistoryItem {
  id: string;
  /** Live research trace (provider progress messages), capped. */
  trace?: TraceEntry[];
  traceStats?: TraceStats;
  question: string;
  depth: Depth;
  horizon?: Horizon;
  budgetWords: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  processor?: string;
  title?: string;
  error?: string;
  events: ActivityEvent[];
  report?: Report;
}

const KEY = "thesis.history.v1";
const MAX_ITEMS = 20;
const EMPTY: HistoryItem[] = [];
let memory: HistoryItem[] | null = null;
let availability: boolean | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Subscribe/snapshot pair for React's useSyncExternalStore. Snapshot identity only changes on writes. */
export const historyStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  getSnapshot(): HistoryItem[] {
    return loadHistory();
  },
  getServerSnapshot(): HistoryItem[] {
    return EMPTY;
  },
};

export function storageAvailable(): boolean {
  if (availability !== null) return availability;
  try {
    const probe = "__thesis_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

export function loadHistory(): HistoryItem[] {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    memory = Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.id === "string") : [];
  } catch {
    memory = [];
  }
  return memory;
}

function persist(items: HistoryItem[]): boolean {
  memory = items;
  notify();
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    // Quota exceeded or unavailable: keep in memory for this tab, drop oldest reports to try once more.
    try {
      const slim = items.map((it, i) => (i < 5 ? it : { ...it, report: undefined }));
      window.localStorage.setItem(KEY, JSON.stringify(slim));
      return true;
    } catch {
      return false;
    }
  }
}

export function upsertHistory(item: HistoryItem): boolean {
  const items = loadHistory().filter((x) => x.id !== item.id);
  items.unshift(item);
  return persist(items.slice(0, MAX_ITEMS));
}

export function patchHistory(id: string, patch: Partial<HistoryItem>): HistoryItem | null {
  const items = loadHistory();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const next = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  items[idx] = next;
  persist([...items]);
  return next;
}

export function getHistoryItem(id: string): HistoryItem | null {
  return loadHistory().find((x) => x.id === id) ?? null;
}

export function removeHistory(id: string): void {
  persist(loadHistory().filter((x) => x.id !== id));
}

export function clearHistory(): void {
  persist([]);
}
