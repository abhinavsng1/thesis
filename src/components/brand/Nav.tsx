import Link from "next/link";
import { Wordmark } from "./Wordmark";
import type { AppMode } from "@/lib/research/config";

export function Nav({ mode, right }: { mode: AppMode; right?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-3 z-30 mx-auto w-[min(1120px,calc(100%-1.5rem))] sm:w-[min(1120px,calc(100%-2rem))]">
      <div className="flex items-center justify-between gap-2 rounded-[14px] border border-rule bg-paper/95 px-3 py-2 shadow-nav backdrop-blur sm:gap-4 sm:px-4 sm:py-2.5">
        <Wordmark />
        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-2" aria-label="Primary">
          <Link href="/" className="btn btn-ghost btn-sm px-2 sm:px-3">
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New research</span>
          </Link>
          <Link href="/research/sample-microsoft" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            Sample report
          </Link>
          <span
            className={`ml-0.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] sm:ml-1 sm:px-2.5 sm:text-[11.5px] ${
              mode === "live" ? "border-teal/30 bg-teal-tint text-teal-deep" : "border-gold/40 bg-gold-soft text-[#7a5a22]"
            }`}
            title={mode === "live" ? "Live research is configured" : "Demo mode: sample reports only"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${mode === "live" ? "bg-teal" : "bg-gold"}`} aria-hidden="true" />
            {mode === "live" ? "Live" : "Demo"}
          </span>
          {right}
        </nav>
      </div>
    </header>
  );
}
