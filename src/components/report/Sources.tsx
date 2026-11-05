"use client";

import { ExternalLink } from "lucide-react";
import type { Report } from "@/lib/schema/report";
import { useSources } from "./SourceContext";

const KIND: Record<Report["sources"][number]["kind"], string> = {
  filing: "Filing",
  earnings_release: "Earnings release",
  presentation: "Presentation",
  transcript: "Call transcript",
  regulatory: "Regulatory",
  dataset: "Dataset",
  news: "News",
  other: "Web",
};

export function Sources({ report }: { report: Report }) {
  const { open } = useSources();
  const lim = report.limitations;
  return (
    <div className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="meta">Research cutoff</p>
          <p className="mt-1 text-[14.5px] leading-[1.55] text-ink-2">{report.researchCutoff}</p>
        </div>
        {lim.missing.length > 0 && (
          <div>
            <p className="meta">Missing data</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[14.5px] leading-[1.55] text-ink-2">
              {lim.missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {lim.uncertainties.length > 0 && (
          <div>
            <p className="meta">Material uncertainty</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[14.5px] leading-[1.55] text-ink-2">
              {lim.uncertainties.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {lim.conflicts.length > 0 && (
          <div>
            <p className="meta">Conflicting evidence</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[14.5px] leading-[1.55] text-ink-2">
              {lim.conflicts.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        <p className="meta">Sources ({report.sources.length})</p>
        <ol className="mt-2 divide-y divide-rule">
          {report.sources.map((s) => (
            <li key={s.id} id={`source-${s.id}`} className="grid grid-cols-[2.2rem_1fr] gap-2 py-2.5 text-[14.5px]">
              <button type="button" className="text-left font-semibold text-teal-deep hover:underline" onClick={() => open(s.id)} aria-label={`Open source ${s.id.slice(1)} details`}>
                {s.id.slice(1)}
              </button>
              <div className="min-w-0">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-teal-deep hover:underline">
                  {s.title}
                  <ExternalLink className="ml-1 inline h-3 w-3 text-muted" aria-hidden="true" />
                </a>
                <p className="text-[13px] text-muted">
                  {[KIND[s.kind], s.publisher, s.publishedAt, s.period].filter(Boolean).join(" · ")}
                </p>
                <p className="hidden break-all text-[12px] text-muted print-full">{s.url}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
