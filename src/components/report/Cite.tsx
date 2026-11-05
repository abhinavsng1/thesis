"use client";

import { useSources } from "./SourceContext";

/** Clickable citation markers rendered as superscript source numbers. */
export function Cite({ ids }: { ids: string[] }) {
  const { sources, open } = useSources();
  const valid = ids.filter((id) => sources.has(id));
  if (valid.length === 0) return null;
  return (
    <span className="whitespace-nowrap">
      {valid.map((id) => {
        const s = sources.get(id)!;
        return (
          <button
            key={id}
            type="button"
            className="cite"
            onClick={() => open(id)}
            aria-label={`Source ${id.slice(1)}: ${s.title}`}
            title={s.title}
          >
            {id.slice(1)}
          </button>
        );
      })}
    </span>
  );
}
