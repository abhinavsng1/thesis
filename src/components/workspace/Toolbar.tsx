"use client";

import { useState } from "react";
import { BookOpenText, Check, Copy, Download, Printer } from "lucide-react";
import type { Report } from "@/lib/schema/report";
import { reportToMarkdown } from "@/lib/report/markdown";

export function Toolbar({ report, docView, onDocView, onOpenSources }: { report: Report; docView: "brief" | "full"; onDocView: (v: "brief" | "full") => void; onOpenSources: () => void }) {
  const [copied, setCopied] = useState<"idle" | "done" | "error">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      setCopied("done");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied("idle"), 1800);
  };

  const download = () => {
    const md = reportToMarkdown(report);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "thesis-report";
    a.href = url;
    a.download = `${slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="seg" role="group" aria-label="Report view">
        <button type="button" aria-pressed={docView === "brief"} onClick={() => onDocView("brief")}>
          Brief
        </button>
        <button type="button" aria-pressed={docView === "full"} onClick={() => onDocView("full")}>
          Full report
        </button>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenSources}>
        <BookOpenText className="h-4 w-4" aria-hidden="true" />
        Sources ({report.sources.length})
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copy} aria-live="polite">
        {copied === "done" ? <Check className="h-4 w-4 text-teal" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied === "done" ? "Copied" : copied === "error" ? "Copy failed" : "Copy Markdown"}
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Download
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print
      </button>
    </div>
  );
}
