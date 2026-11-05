"use client";

import { useState } from "react";
import type { PublicConfig } from "@/lib/research/config";
import type { Report } from "@/lib/schema/report";
import { Composer } from "./Composer";
import { RecentResearch } from "./RecentResearch";
import { SampleReports } from "./SampleReports";
import { ModeNotice } from "./ModeNotice";

type Sample = Pick<Report, "id" | "title" | "question" | "asOf" | "stats">;

export function Home({ config, samples }: { config: PublicConfig; samples: Sample[] }) {
  const [draft, setDraft] = useState("");

  return (
    <main className="mx-auto w-[min(1120px,calc(100%-1.5rem))] sm:w-[min(1120px,calc(100%-2rem))] pb-24 pt-14 sm:pt-20">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <h1 className="display text-[44px] text-ink sm:text-[64px] lg:text-[72px]">
            Deep research.
            <br />
            Clear conviction.
          </h1>
          <p className="mt-6 max-w-[52ch] text-[17.5px] leading-[1.6] text-ink-2">
            Ask an investing question. Thesis reads filings, earnings releases and call transcripts, then returns a sourced brief you can act on in thirty seconds, a detailed thesis when you need it, and charts that show the evidence.
          </p>
          <div className="mt-10">
            <Composer config={config} draft={draft} onDraftChange={setDraft} />
          </div>
          <ModeNotice config={config} />
        </div>
        <aside className="space-y-10 lg:pt-4">
          <SampleReports samples={samples} />
          <RecentResearch />
        </aside>
      </section>
    </main>
  );
}
