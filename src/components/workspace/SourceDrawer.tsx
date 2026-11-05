"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Source } from "@/lib/schema/report";

const KIND: Record<Source["kind"], string> = {
  filing: "Filing",
  earnings_release: "Earnings release",
  presentation: "Presentation",
  transcript: "Call transcript",
  regulatory: "Regulatory",
  dataset: "Dataset",
  news: "News",
  other: "Web",
};

export function SourceDrawer({ open, onClose, sources, activeId, onSelect }: { open: boolean; onClose: () => void; sources: Source[]; activeId: string | null; onSelect: (id: string) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = sources.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && active) document.getElementById(`drawer-${active.id}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-40" role="presentation">
      <button type="button" className="absolute inset-0 bg-ink/25" aria-label="Close sources" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col bg-paper shadow-nav"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 id="drawer-title" className="font-serif text-[21px] font-medium text-ink">
            Sources <span className="text-muted">({sources.length})</span>
          </h2>
          <button ref={closeRef} type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close sources panel">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {active ? (
            <div className="border-b border-rule bg-teal-tint px-5 py-4">
              <p className="meta">Source {active.id.slice(1)} · {KIND[active.kind]}</p>
              <h3 className="mt-1 font-serif text-[19px] font-medium leading-snug text-ink">{active.title}</h3>
              <p className="mt-1 text-[13.5px] text-muted">{[active.publisher, active.publishedAt, active.period].filter(Boolean).join(" · ")}</p>
              <a href={active.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 break-all text-[13.5px] font-semibold text-teal-deep hover:underline">
                {active.url}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
              {active.excerpts.length > 0 && (
                <div className="mt-3">
                  <p className="meta">Relevant evidence</p>
                  <ul className="mt-1.5 space-y-2">
                    {active.excerpts.map((e, i) => (
                      <li key={i} className="border-l-2 border-teal/50 pl-3 font-serif text-[15.5px] leading-[1.5] text-ink">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[12px] text-muted">Retrieved {active.retrievedAt.slice(0, 10)}.</p>
            </div>
          ) : (
            <p className="px-5 py-4 text-[14px] text-muted">Select a source to see its details and the evidence it supports.</p>
          )}
          <ol className="divide-y divide-rule">
            {sources.map((s) => (
              <li key={s.id} id={`drawer-${s.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={s.id === activeId ? "true" : undefined}
                  className={`grid w-full grid-cols-[2rem_1fr] gap-2 px-5 py-3 text-left hover:bg-teal-tint ${s.id === activeId ? "bg-teal-tint" : ""}`}
                >
                  <span className="font-semibold text-teal-deep">{s.id.slice(1)}</span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium leading-snug text-ink">{s.title}</span>
                    <span className="block text-[12.5px] text-muted">{[KIND[s.kind], s.publisher, s.publishedAt].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
