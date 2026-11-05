import type { Report } from "@/lib/schema/report";
import { Cite } from "./Cite";

const TONE: Record<"bear" | "base" | "bull", string> = {
  bear: "border-t-down",
  base: "border-t-ink",
  bull: "border-t-teal",
};

export function Scenarios({ s }: { s: NonNullable<Report["scenarios"]> }) {
  return (
    <div>
      <p className="text-[16px] leading-[1.6] text-ink-2">{s.methodology}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {s.cases.map((c) => (
          <div key={c.name} className={`border-t-2 pt-3 ${TONE[c.name]}`}>
            <h3 className="font-serif text-[20px] font-medium text-ink">
              {c.name.charAt(0).toUpperCase() + c.name.slice(1)} case
              <Cite ids={c.sourceIds} />
            </h3>
            <p className="mt-2 text-[15px] leading-[1.55] text-ink">{c.summary}</p>
            <p className="meta mt-3">Assumptions</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[14px] leading-[1.5] text-ink-2">
              {c.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            <p className="meta mt-3">Outcome</p>
            <p className="mt-1 text-[14.5px] leading-[1.55] text-ink">{c.outcome}</p>
          </div>
        ))}
      </div>
      {s.sensitivity && (
        <div className="mt-7 overflow-x-auto">
          <p className="meta mb-2">Sensitivity · {s.sensitivity.variable}</p>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col"></th>
                {s.sensitivity.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.sensitivity.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="!text-left font-medium">
                    {r.label}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={i} className={/down/i.test(v) ? "text-down" : /up/i.test(v) ? "text-teal-deep" : "text-ink-2"}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {s.sensitivity.note && <p className="mt-2 text-[12.5px] text-muted">{s.sensitivity.note}</p>}
        </div>
      )}
      {s.caveat && <p className="mt-4 border-l-2 border-gold pl-3 text-[14px] italic leading-relaxed text-ink-2">{s.caveat}</p>}
    </div>
  );
}
