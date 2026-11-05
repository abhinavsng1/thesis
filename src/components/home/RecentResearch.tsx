"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { clearHistory, historyStore, removeHistory, storageAvailable } from "@/lib/client/history";
import { StatusBadge } from "@/components/workspace/StatusBadge";

export function RecentResearch() {
  const items = useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getServerSnapshot);
  const available = useSyncExternalStore(
    () => () => {},
    () => storageAvailable(),
    () => true,
  );

  return (
    <section aria-labelledby="recent-h">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-h" className="meta">
          Recent research
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            className="text-[12.5px] font-semibold text-muted hover:text-down"
            onClick={() => clearHistory()}
          >
            Clear
          </button>
        )}
      </div>
      {!available && (
        <p className="mt-3 text-[13.5px] text-muted">Browser storage is unavailable, so recent research will not persist after this tab closes.</p>
      )}
      {items.length === 0 ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Nothing yet. Reports you run are kept only in this browser&rsquo;s local storage, not on a server.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/research/${encodeURIComponent(it.id)}`} className="block font-serif text-[17px] leading-snug text-ink hover:text-teal-deep">
                  {it.title ?? it.question}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                  <StatusBadge status={it.status} compact />
                  <span>{new Date(it.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span>· {it.depth}</span>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm shrink-0 px-1.5"
                aria-label={`Remove "${it.question}" from recent research`}
                onClick={() => removeHistory(it.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
