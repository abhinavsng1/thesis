"use client";

import { useState } from "react";
import type { PublicConfig } from "@/lib/research/config";
import type { SampleSummary } from "@/lib/research/samples";
import { Composer } from "./Composer";
import { RecentResearch } from "./RecentResearch";
import { SampleReports } from "./SampleReports";
import { ModeNotice } from "./ModeNotice";

export function Home({ config, samples }: { config: PublicConfig; samples: SampleSummary[] }) {
  const [draft, setDraft] = useState("");

  return (
    <main className="mx-auto w-[min(1120px,calc(100%-1.5rem))] pb-20 pt-8 sm:w-[min(1120px,calc(100%-2rem))] sm:pt-12">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div>
          <h1 className="display text-[42px] text-ink sm:text-[56px] lg:text-[60px]">
            Deep research.
            <br />
            Clear conviction.
          </h1>
          <p className="mt-4 max-w-[54ch] text-[16.5px] leading-[1.6] text-ink-2">
            Ask an investing question. Thesis reads filings, earnings releases and call transcripts while you watch, then returns a sourced brief you can act on in thirty seconds, a full thesis when you need it, and charts that show the evidence.
          </p>
          <div className="mt-6">
            <Composer config={config} draft={draft} onDraftChange={setDraft} />
          </div>
          <ModeNotice config={config} />
        </div>
        <aside className="space-y-9 lg:pt-2">
          <SampleReports samples={samples} />
          <RecentResearch />
        </aside>
      </section>

      <section aria-labelledby="how-h" className="mt-16 border-t border-rule pt-8 sm:mt-20">
        <h2 id="how-h" className="meta">
          How a report is made
        </h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3 sm:gap-10">
          {[
            { n: "1", title: "Research you can watch", body: "A research agent plans, searches and reads primary sources. Every search, document and source count streams to your screen as it happens." },
            { n: "2", title: "Evidence, not prose", body: "Findings come back as a structured evidence pack: dated facts, metric rows and risks, each tied to the source that supports it." },
            { n: "3", title: "A report that earns its length", body: "One pass turns the evidence into a brief, a thesis, charts and scenarios, with every claim cited and every gap stated." },
          ].map((s) => (
            <li key={s.n} className="grid grid-cols-[2rem_1fr] gap-x-3">
              <span className="font-serif text-[26px] leading-none text-teal" aria-hidden="true">
                {s.n}
              </span>
              <div>
                <h3 className="font-serif text-[19px] font-medium leading-snug text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-[1.6] text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-5 text-[12.5px] text-muted">
        <span>Thesis researches public filings and releases. It does not provide investment advice or live market prices.</span>
        <span>Reports you run stay in this browser.</span>
      </footer>
    </main>
  );
}
