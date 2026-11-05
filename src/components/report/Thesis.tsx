import type { Report } from "@/lib/schema/report";
import { Cite } from "./Cite";
import { KindTag } from "./KindTag";

export function Thesis({ points }: { points: Report["thesis"] }) {
  return (
    <ol className="divide-y divide-rule">
      {points.map((t, i) => (
        <li key={i} className="grid gap-2 py-5 first:pt-0 sm:grid-cols-[2.25rem_1fr]">
          <span className="font-serif text-[22px] leading-none text-teal" aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <h3 className="font-serif text-[21px] font-medium leading-snug text-ink">
              {t.claim}
              <Cite ids={t.sourceIds} />
            </h3>
            <p className="mt-2 text-[16px] leading-[1.6] text-ink-2">
              <KindTag kind={t.kind} /> <span className="ml-1">{t.evidence}</span>
            </p>
            <p className="mt-2 text-[16px] leading-[1.6] text-ink">
              <span className="font-semibold">So what.</span> {t.implication}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
