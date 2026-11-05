export function Section({ id, title, children, eyebrow }: { id: string; title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t border-rule pt-8 first:border-t-0 first:pt-0">
      {eyebrow && <p className="meta mb-1">{eyebrow}</p>}
      <h2 id={`${id}-h`} className="h2 text-[27px] text-ink sm:text-[30px]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
