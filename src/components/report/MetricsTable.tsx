import type { MetricsTable as MetricsTableT } from "@/lib/schema/report";
import { formatNumber } from "@/lib/report/markdown";
import { Cite } from "./Cite";

export function MetricsTable({ table }: { table: MetricsTableT }) {
  // Group rows by their period set so comparisons across different fiscal calendars get their own column sets.
  const groups = new Map<string, { periods: string[]; rows: MetricsTableT["rows"] }>();
  for (const row of table.rows) {
    const periods = row.values.map((v) => v.period);
    const key = periods.join("|");
    const g = groups.get(key) ?? { periods, rows: [] };
    g.rows.push(row);
    groups.set(key, g);
  }
  return (
    <figure className="avoid-break">
      {[...groups.values()].map((g, gi) => (
        <div key={gi} className={`overflow-x-auto ${gi > 0 ? "mt-6" : ""}`}>
          <table className="data-table min-w-[480px]">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col" className="!text-left">Unit</th>
                {g.periods.map((p) => (
                  <th key={p} scope="col">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((row, ri) => (
                <tr key={ri}>
                  <th scope="row" className="!text-left font-medium text-ink">
                    {row.entity ? <span className="text-muted">{row.entity} · </span> : null}
                    {row.metric}
                    {row.note ? <span className="block text-[12px] font-normal text-muted">{row.note}</span> : null}
                  </th>
                  <td className="!text-left text-muted">{row.unit}</td>
                  {g.periods.map((p) => {
                    const v = row.values.find((x) => x.period === p);
                    if (!v || v.value === null) return <td key={p} className="text-muted">—</td>;
                    return (
                      <td key={p} className={v.isEstimate ? "italic text-ink-2" : "text-ink"}>
                        {formatNumber(v.value)}
                        {v.isEstimate ? <abbr title="Estimate or guidance" className="ml-0.5 no-underline">E</abbr> : null}
                        <Cite ids={v.sourceIds} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <figcaption className="mt-3 text-[13px] leading-relaxed text-muted">
        {table.currency ? `Currency ${table.currency}. ` : ""}
        {table.periodNote ? `${table.periodNote} ` : ""}
        <em>E</em> marks estimates or guidance.
      </figcaption>
    </figure>
  );
}
