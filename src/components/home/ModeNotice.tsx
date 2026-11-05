import type { PublicConfig } from "@/lib/research/config";

export function ModeNotice({ config }: { config: PublicConfig }) {
  if (config.mode === "live") {
    return (
      <p className="mt-4 text-[13.5px] text-muted">
        Live research is on. Quick runs use the <span className="font-semibold text-ink-2">{config.processors.quick}</span> processor and deep runs use{" "}
        <span className="font-semibold text-ink-2">{config.processors.deep}</span>; synthesis uses {config.synthesisModel}. Each run is a paid provider request.
      </p>
    );
  }
  return (
    <div className="mt-4 rounded-[12px] border border-gold/40 bg-gold-soft/60 px-4 py-3 text-[14px] leading-relaxed text-[#5b451d]">
      <p className="font-semibold">Demo mode: live research is off on this deployment.</p>
      <p className="mt-1">
        Missing: {config.missing.join(" and ")}. You can explore the labelled sample reports in full. To enable live research, set those variables (see <code className="rounded bg-white/70 px-1">.env.example</code>) and redeploy. The composer will not answer arbitrary questions with canned content.
      </p>
    </div>
  );
}
