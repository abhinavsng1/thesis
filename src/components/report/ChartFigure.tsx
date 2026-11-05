"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType as ValueType } from "recharts";
import type { NameType } from "recharts/types/component/DefaultTooltipContent";
import { Table2 } from "lucide-react";
import type { Chart } from "@/lib/schema/report";
import { formatNumber } from "@/lib/report/markdown";
import { Cite } from "./Cite";

const TEAL = "#0a7f92";
const GOLD = "#b08a4d";
const DOWN = "#b5473b";
const NEUTRAL = "#7d9599";
const INK = "#123d47";
const MUTED = "#6b8589";
const RULE = "#dfe6e5";

function seriesColor(i: number, s: Chart["series"][number]): string {
  if (s.isDownside) return DOWN;
  return i === 0 ? TEAL : i === 1 ? GOLD : NEUTRAL;
}

/** Union of periods in first-seen order, so series with partial coverage (e.g. a forecast tail) still align. */
export function chartRows(chart: Chart): Array<Record<string, string | number | null>> {
  const periods: string[] = [];
  for (const s of chart.series) for (const p of s.points) if (!periods.includes(p.period)) periods.push(p.period);
  return periods.map((period) => {
    const row: Record<string, string | number | null> = { period };
    chart.series.forEach((s, i) => {
      row[`s${i}`] = s.points.find((p) => p.period === period)?.value ?? null;
    });
    return row;
  });
}

/** Rounded axis bounds and ticks so the scale reads 0/50/100 rather than 0/55/110. */
export function niceScale(values: number[], steps = 5): { domain: [number, number]; ticks: number[] } {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(max - min, 1e-9);
  const raw = span / steps;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const hi = Math.ceil(max / step) * step;
  const lo = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toFixed(10)));
  return { domain: [lo, hi], ticks };
}

function unitLabel(chart: Chart): string {
  return [chart.currency, chart.unit].filter(Boolean).join(" ");
}

export function ChartFigure({ chart, index }: { chart: Chart; index: number }) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  const rows = chartRows(chart);
  const unit = unitLabel(chart);
  const hasForecast = chart.series.some((s) => s.isForecast);
  const patternId = `${id}-hatch`;
  const scale = niceScale(chart.series.flatMap((s) => s.points.map((p) => p.value)).filter((v): v is number => v !== null));

  const TooltipContent = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-[9px] border border-rule bg-paper px-3 py-2 text-[13px] shadow-panel">
        <p className="font-semibold text-ink">{String(label)}</p>
        {payload.map((p) => {
          const i = Number(String(p.dataKey).slice(1));
          const s = chart.series[i];
          if (!s || p.value === null || p.value === undefined) return null;
          return (
            <p key={String(p.dataKey)} className="mt-0.5 flex items-center gap-2 text-ink-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(i, s) }} aria-hidden="true" />
              {s.name}
              {s.isForecast ? " (forecast)" : ""}: <span className="font-semibold text-ink">{formatNumber(Number(p.value))}</span> {unit}
            </p>
          );
        })}
      </div>
    );
  };

  const axisProps = {
    tick: { fill: MUTED, fontSize: 12 },
    axisLine: { stroke: RULE },
    tickLine: false as const,
  };

  const isLine = chart.kind === "line";

  return (
    <figure className="avoid-break" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-title`} className="font-serif text-[20px] font-medium leading-snug text-ink">
          <span className="text-muted">Figure {index + 1}. </span>
          {chart.title}
        </h3>
        <span className="text-[12.5px] text-muted">{unit}</span>
      </div>
      <p className="mt-2 text-[16px] leading-[1.6] text-ink">
        {chart.takeaway}
        <Cite ids={chart.sourceIds} />
      </p>
      <div className="mt-4 h-[260px] w-full sm:h-[300px]" role="img" aria-label={`${chart.title}. ${chart.takeaway}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 300 }}>
          {isLine ? (
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={RULE} />
              <XAxis dataKey="period" {...axisProps} />
              <YAxis {...axisProps} width={44} domain={scale.domain} ticks={scale.ticks} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip content={TooltipContent} cursor={{ stroke: RULE }} />
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12.5, color: INK }} iconType="plainline" />}
              {chart.series.map((s, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`s${i}`}
                  name={`${s.name}${s.isForecast ? " (forecast)" : ""}`}
                  stroke={seriesColor(i, s)}
                  strokeWidth={2}
                  strokeDasharray={s.isForecast ? "6 4" : undefined}
                  dot={{ r: 3.5, strokeWidth: 0, fill: seriesColor(i, s) }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%" barGap={2}>
              <defs>
                <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="#fff" />
                  <rect width="2.5" height="6" fill={TEAL} />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke={RULE} />
              <XAxis dataKey="period" {...axisProps} />
              <YAxis {...axisProps} width={44} domain={scale.domain} ticks={scale.ticks} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip content={TooltipContent} cursor={{ fill: "rgba(18,61,71,0.05)" }} />
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12.5, color: INK }} iconType="square" />}
              {chart.series.map((s, i) => (
                <Bar
                  key={i}
                  dataKey={`s${i}`}
                  name={`${s.name}${s.isForecast ? " (forecast)" : ""}`}
                  fill={s.isForecast ? `url(#${patternId})` : seriesColor(i, s)}
                  stroke={s.isForecast ? TEAL : undefined}
                  strokeDasharray={s.isForecast ? "4 3" : undefined}
                  stackId={chart.kind === "stacked-bar" ? "stack" : chart.kind === "bar" ? "single" : undefined}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                  maxBarSize={56}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
        <span>
          {chart.periodNote ?? ""}
          {hasForecast ? (chart.periodNote ? " " : "") + "Dashed or hatched series are forecasts or guidance, not reported figures." : ""}
        </span>
        <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable} aria-controls={`${id}-table`}>
          <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
          {showTable ? "Hide data" : "Show data"}
        </button>
      </figcaption>
      <div id={`${id}-table`} className={`${showTable ? "" : "hidden"} print-full mt-3 overflow-x-auto`}>
        <table className="data-table">
          <caption className="sr-only">Data for {chart.title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {chart.series.map((s, i) => (
                <th key={i} scope="col">
                  {s.name}
                  {s.isForecast ? " (forecast)" : ""} ({unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.period)}>
                <th scope="row" className="!text-left font-medium">
                  {String(r.period)}
                </th>
                {chart.series.map((_, i) => (
                  <td key={i}>{r[`s${i}`] === null ? "—" : formatNumber(Number(r[`s${i}`]))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
