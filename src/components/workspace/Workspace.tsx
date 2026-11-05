"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppMode } from "@/lib/research/config";
import type { Source } from "@/lib/schema/report";
import { useResearchJob } from "@/lib/client/useResearchJob";
import { SourceContext } from "@/components/report/SourceContext";
import { ReportDocument, sectionsFor } from "@/components/report/ReportDocument";
import { SectionNav } from "./SectionNav";
import { SourceDrawer } from "./SourceDrawer";
import { Toolbar } from "./Toolbar";
import { StatePanel } from "./StatePanel";
import { ActivityLog } from "./ActivityLog";
import { StatusBadge } from "./StatusBadge";

export function Workspace({ id, mode }: { id: string; mode: AppMode }) {
  const { view, cancel, retry } = useResearchJob(id);
  const [docView, setDocView] = useState<"brief" | "full">("brief");
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const report = view.report;
  const sources = useMemo(() => new Map<string, Source>((report?.sources ?? []).map((s) => [s.id, s])), [report]);
  const open = useCallback((sid: string) => {
    setOpenSource(sid);
    setDrawerOpen(true);
  }, []);

  // Printing always produces the full report; the on-screen view is restored afterwards.
  useEffect(() => {
    let previous: "brief" | "full" = "brief";
    const before = () => {
      setDocView((v) => {
        previous = v;
        return "full";
      });
    };
    const after = () => setDocView(previous);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const question = report?.question ?? view.item?.question ?? "";
  const sections = report ? sectionsFor(report).filter((s) => docView === "full" || !s.full) : [];
  const isSample = id.startsWith("sample-");

  return (
    <SourceContext.Provider value={{ sources, open }}>
      <main className="mx-auto w-[min(1120px,calc(100%-1.5rem))] sm:w-[min(1120px,calc(100%-2rem))] pb-24 pt-8 sm:pt-10">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
          <div className="min-w-0">
            <p className="meta flex items-center gap-2">
              <Link href="/" className="hover:text-ink">
                Research
              </Link>
              <span aria-hidden="true">/</span>
              <StatusBadge status={view.status} />
            </p>
            {question && !report && view.status !== "queued" && view.status !== "researching" && view.status !== "synthesizing" && (
              <p className="mt-1 truncate font-serif text-[19px] text-ink">{question}</p>
            )}
          </div>
          {report && (
            <Toolbar
              report={report}
              docView={docView}
              onDocView={setDocView}
              onOpenSources={() => {
                setOpenSource(null);
                setDrawerOpen(true);
              }}
            />
          )}
        </div>

        {report ? (
          <div className="doc-grid lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12">
            <SectionNav sections={sections} />
            <div className="min-w-0 lg:max-w-[760px]">
              <ReportDocument report={report} view={docView} />
              {!isSample && (
                <div className="no-print mt-10">
                  <ActivityLog events={view.events} trace={view.trace} stats={view.traceStats} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`mx-auto ${view.status === "queued" || view.status === "researching" || view.status === "synthesizing" ? "max-w-[1040px]" : "max-w-[760px]"}`}>
            <StatePanel view={view} mode={mode} onCancel={cancel} onRetry={retry} />
            {!isSample && view.events.length > 0 && (
              <div className="mt-8">
                <ActivityLog events={view.events} trace={view.status === "failed" || view.status === "cancelled" ? view.trace : []} stats={view.traceStats} defaultOpen />
              </div>
            )}
          </div>
        )}
      </main>
      <SourceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} sources={report?.sources ?? []} activeId={openSource} onSelect={setOpenSource} />
    </SourceContext.Provider>
  );
}
