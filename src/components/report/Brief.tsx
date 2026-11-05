import type { Report } from "@/lib/schema/report";
import { Cite } from "./Cite";
import { KindTag } from "./KindTag";

const ROWS: Array<{ key: keyof Report["brief"]; label: string }> = [
  { key: "answer", label: "Answer" },
  { key: "opportunity", label: "Opportunity" },
  { key: "risk", label: "Risk" },
  { key: "uncertainty", label: "Key uncertainty" },
];

export function Brief({ report }: { report: Report }) {
  return (
    <div className="rounded-[14px] border border-rule bg-panel/70 p-5 sm:p-6">
      <p className="font-serif text-[20px] leading-[1.4] text-ink sm:text-[22px]">{report.stance}</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-[9.5rem_1fr] sm:gap-x-6 sm:gap-y-4">
        {ROWS.map(({ key, label }) => {
          const c = report.brief[key];
          return (
            <div key={key} className="contents">
              <dt className="flex items-start gap-2 sm:block">
                <span className="meta">{label}</span>
                <span className="sm:mt-1 sm:block">
                  <KindTag kind={c.kind} />
                </span>
              </dt>
              <dd className="text-[16.5px] leading-[1.6] text-ink">
                {c.text}
                <Cite ids={c.sourceIds} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
