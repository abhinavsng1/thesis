import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SampleSummary } from "@/lib/research/samples";

export function SampleReports({ samples }: { samples: SampleSummary[] }) {
  return (
    <section aria-labelledby="samples-h">
      <div className="flex items-baseline justify-between">
        <h2 id="samples-h" className="meta">
          Sample reports
        </h2>
        <span className="text-[12.5px] text-muted">Open without credentials</span>
      </div>
      <ul className="mt-3 space-y-3">
        {samples.map((s) => (
          <li key={s.id}>
            <Link href={`/research/${s.id}`} className="group panel block p-4 transition-colors hover:border-teal/50 sm:p-5">
              <p className="meta">Sample · as of {s.asOf}</p>
              <p className="mt-1.5 font-serif text-[19px] leading-snug text-ink group-hover:text-teal-deep">{s.title}</p>
              <p className="mt-2 line-clamp-2 text-[13.5px] leading-[1.55] text-ink-2">{s.stance}</p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                <span>{s.sources} sources</span>
                <span>{s.charts} charts</span>
                <span>{s.stats.readingMinutes} min read</span>
                <span className="ml-auto inline-flex items-center gap-1 font-semibold text-teal-deep">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">Compiled from company filings and releases on the dates shown, and labelled as samples inside the report.</p>
    </section>
  );
}
