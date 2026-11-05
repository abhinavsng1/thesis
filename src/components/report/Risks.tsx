import type { Report } from "@/lib/schema/report";
import { Cite } from "./Cite";

const LABEL: Record<Report["risks"][number]["kind"], string> = {
  evidence_against: "Evidence against",
  execution: "Execution",
  financial: "Financial",
  invalidator: "Would invalidate",
};

export function Risks({ risks }: { risks: Report["risks"] }) {
  return (
    <ul className="divide-y divide-rule">
      {risks.map((r, i) => (
        <li key={i} className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <span className={`meta ${r.kind === "invalidator" ? "text-down" : ""}`}>{LABEL[r.kind]}</span>
          <div>
            <h3 className="font-serif text-[19px] font-medium leading-snug text-ink">
              {r.title}
              <Cite ids={r.sourceIds} />
            </h3>
            <p className="mt-1.5 text-[15.5px] leading-[1.6] text-ink-2">{r.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
