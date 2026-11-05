import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Report } from "@/lib/schema/report";

type Sample = Pick<Report, "id" | "title" | "question" | "asOf" | "stats">;

export function SampleReports({ samples }: { samples: Sample[] }) {
  return (
    <section aria-labelledby="samples-h">
      <div className="flex items-baseline justify-between">
        <h2 id="samples-h" className="meta">
          Sample reports
        </h2>
        <span className="text-[12.5px] text-muted">No credentials needed</span>
      </div>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {samples.map((s) => (
          <li key={s.id}>
            <Link href={`/research/${s.id}`} className="group block py-4 hover:bg-teal-tint/60 -mx-2 px-2 rounded-[8px]">
              <p className="font-serif text-[19px] leading-snug text-ink">{s.title}</p>
              <p className="mt-1.5 text-[13.5px] text-muted">
                Sample · as of {s.asOf} · {s.stats.readingMinutes} min read
                <ArrowRight className="ml-1.5 inline h-3.5 w-3.5 text-teal opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
        Compiled from company filings and releases on the dates shown; clearly labelled as samples inside the report.
      </p>
    </section>
  );
}
