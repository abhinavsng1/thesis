"use client";

import { useEffect, useState } from "react";
import type { SectionDef } from "@/components/report/ReportDocument";

export function SectionNav({ sections }: { sections: SectionDef[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((x): x is HTMLElement => Boolean(x));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  if (!sections.length) return null;
  return (
    <nav aria-label="Report sections" className="no-print hidden lg:block">
      <ol className="sticky top-24 space-y-0.5 border-l border-rule">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              className={`-ml-px block border-l-2 py-1.5 pl-3 text-[13.5px] leading-snug transition-colors ${
                active === s.id ? "border-teal font-semibold text-ink" : "border-transparent text-muted hover:border-rule-strong hover:text-ink-2"
              }`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
