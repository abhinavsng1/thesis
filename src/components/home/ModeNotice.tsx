import type { PublicConfig } from "@/lib/research/config";

export function ModeNotice({ config }: { config: PublicConfig }) {
  if (config.mode === "live") {
    return (
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        Live research is on. Quick runs usually take three to five minutes, deep runs longer; you can watch every step and leave the page while it works.
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
