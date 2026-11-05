import type { ActivityEvent } from "@/lib/schema/request";
import type { TraceEntry, TraceStats } from "@/lib/client/history";
import { Timeline, groupSteps } from "./ResearchProgress";

export function ActivityLog({ events, trace = [], stats = null, defaultOpen = false }: { events: ActivityEvent[]; trace?: TraceEntry[]; stats?: TraceStats | null; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-[12px] border border-rule bg-paper" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-semibold text-ink-2 hover:text-ink">
        Research activity <span className="font-normal text-muted">({events.length} job events{trace.length ? `, ${trace.length} agent steps` : ""}, observable only)</span>
      </summary>
      {trace.length > 0 && (
        <div className="border-t border-rule px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="meta">What the research agent did</p>
            {stats && (
              <p className="text-[12.5px] text-muted">
                {stats.read.toLocaleString()} sources read of {stats.considered.toLocaleString()} considered
              </p>
            )}
          </div>
          <Timeline blocks={groupSteps(trace)} live={false} />
        </div>
      )}
      <ol className="divide-y divide-rule border-t border-rule">
        {events.length === 0 && <li className="px-4 py-3 text-[13.5px] text-muted">No events recorded yet.</li>}
        {events.map((e, i) => (
          <li key={i} className="grid gap-1 px-4 py-2.5 text-[13.5px] sm:grid-cols-[5.5rem_1fr]">
            <time dateTime={e.at} className="text-muted tabular-nums">
              {new Date(e.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </time>
            <div>
              <span className="text-ink">{e.message}</span>
              {e.detail && (
                <span className="ml-2 text-[12px] text-muted">
                  {Object.entries(e.detail)
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join(" · ")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
