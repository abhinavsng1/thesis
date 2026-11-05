import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Thesis home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--ink)" />
        <path d="M8 9.5h16M16 9.5v14" stroke="var(--ivory)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="23.5" cy="23.5" r="2.4" fill="var(--teal)" />
      </svg>
      <span className="font-serif text-[22px] font-medium tracking-tight text-ink leading-none">Thesis</span>
    </Link>
  );
}
