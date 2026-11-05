import type { Report } from "@/lib/schema/report";
import { Cite } from "./Cite";

export function Catalysts({ items }: { items: Report["catalysts"] }) {
  return (
    <ol className="relative ml-2 border-l border-rule-strong pl-6">
      {items.map((c, i) => (
        <li key={i} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-teal bg-paper" aria-hidden="true" />
          <p className="meta">{c.timing}</p>
          <p className="mt-1 font-serif text-[18.5px] font-medium leading-snug text-ink">
            {c.event}
            <Cite ids={c.sourceIds} />
          </p>
          {c.watch && (
            <p className="mt-1 text-[14.5px] leading-[1.55] text-ink-2">
              <span className="font-semibold text-ink">Watch:</span> {c.watch}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
