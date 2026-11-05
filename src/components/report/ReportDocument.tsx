"use client";

import type { Report } from "@/lib/schema/report";
import { HORIZON_LABELS, type Horizon } from "@/lib/schema/request";
import { Brief } from "./Brief";
import { Thesis } from "./Thesis";
import { MetricsTable } from "./MetricsTable";
import { ChartFigure } from "./ChartFigure";
import { Scenarios } from "./Scenarios";
import { Risks } from "./Risks";
import { Catalysts } from "./Catalysts";
import { Sources } from "./Sources";
import { Section } from "./Section";

export interface SectionDef {
  id: string;
  label: string;
  full: boolean; // only shown in full view
}

export function sectionsFor(report: Report): SectionDef[] {
  const s: SectionDef[] = [{ id: "brief", label: "Executive brief", full: false }];
  s.push({ id: "thesis", label: "Investment thesis", full: true });
  if (report.metrics) s.push({ id: "evidence", label: "Financial evidence", full: true });
  if (report.charts.length) s.push({ id: "visuals", label: "Financial visuals", full: false });
  if (report.scenarios) s.push({ id: "scenarios", label: "Valuation and scenarios", full: true });
  s.push({ id: "risks", label: "Risks and counterarguments", full: true });
  if (report.catalysts.length) s.push({ id: "catalysts", label: "Catalysts and monitoring", full: true });
  s.push({ id: "sources", label: "Sources and limitations", full: false });
  return s;
}

export function ReportDocument({ report, view }: { report: Report; view: "brief" | "full" }) {
  const full = view === "full";
  const horizon = report.horizon ? HORIZON_LABELS[report.horizon as Horizon] ?? report.horizon : null;
  const topCharts = full ? report.charts : report.charts.slice(0, 1);
  return (
    <article className="doc-main prose-doc">
      <header className="mb-8">
        <p className="meta flex flex-wrap items-center gap-x-2">
          <span>{report.mode === "sample" ? "Sample report" : "Research report"}</span>
          <span aria-hidden="true">·</span>
          <span>As of {report.asOf}</span>
          {horizon && (
            <>
              <span aria-hidden="true">·</span>
              <span>{horizon}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>
            {report.stats.wordCount.toLocaleString()} words · {report.stats.readingMinutes} min
          </span>
        </p>
        <h1 className="display mt-3 text-[34px] text-ink sm:text-[44px]">{report.title}</h1>
        <p className="mt-3 text-[15.5px] text-ink-2">
          <span className="font-semibold text-ink">Question.</span> {report.question}
        </p>
        {report.sampleNotice && (
          <p className="mt-4 rounded-[10px] border border-gold/40 bg-gold-soft/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#5b451d]">{report.sampleNotice}</p>
        )}
      </header>

      <div className="space-y-10">
        <Section id="brief" title="Executive brief">
          <Brief report={report} />
        </Section>

        {full && (
          <Section id="thesis" title="Investment thesis">
            <Thesis points={report.thesis} />
          </Section>
        )}

        {full && report.metrics && (
          <Section id="evidence" title={report.metrics.title}>
            <MetricsTable table={report.metrics} />
          </Section>
        )}

        {topCharts.length > 0 && (
          <Section id="visuals" title="Financial visuals" eyebrow={!full && report.charts.length > 1 ? `Showing 1 of ${report.charts.length}; open the full report for all figures` : undefined}>
            <div className="space-y-10">
              {topCharts.map((c, i) => (
                <ChartFigure key={c.id} chart={c} index={i} />
              ))}
            </div>
          </Section>
        )}

        {full && report.scenarios && (
          <Section id="scenarios" title="Valuation and scenarios">
            <Scenarios s={report.scenarios} />
          </Section>
        )}

        {full && (
          <Section id="risks" title="Risks and counterarguments">
            <Risks risks={report.risks} />
          </Section>
        )}

        {full && report.catalysts.length > 0 && (
          <Section id="catalysts" title="Catalysts and monitoring">
            <Catalysts items={report.catalysts} />
          </Section>
        )}

        <Section id="sources" title="Sources and limitations">
          <Sources report={report} />
        </Section>
      </div>

      {report.usage && (report.usage.synthesis || report.usage.provider) && (
        <footer className="mt-10 border-t border-rule pt-4 text-[12.5px] leading-relaxed text-muted">
          {report.usage.provider && (
            <p>
              Research: {report.usage.provider.name} · processor {report.usage.provider.processor} · run {report.usage.provider.runId}
              {report.usage.provider.listPriceUsd !== undefined ? ` · list price $${report.usage.provider.listPriceUsd.toFixed(3)} per run (published rate, not a metered charge)` : ""}
            </p>
          )}
          {report.usage.synthesis && (
            <p>
              Synthesis: {report.usage.synthesis.model} · {report.usage.synthesis.inputTokens.toLocaleString()} input tokens · {report.usage.synthesis.outputTokens.toLocaleString()} output tokens (measured by the provider)
              {report.usage.synthesis.cacheReadTokens ? ` · ${report.usage.synthesis.cacheReadTokens.toLocaleString()} read from cache` : ""}
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
