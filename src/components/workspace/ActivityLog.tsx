import type { ActivityEvent } from "@/lib/schema/request";

export function ActivityLog({ events, defaultOpen = false }: { events: ActivityEvent[]; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-[12px] border border-rule bg-paper" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-semibold text-ink-2 hover:text-ink">
        Research activity <span className="font-normal text-muted">({events.length} events, observable only)</span>
      </summary>
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
