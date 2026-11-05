import type { EvidenceKind } from "@/lib/schema/report";

const LABEL: Record<EvidenceKind, string> = {
  reported: "Reported",
  guidance: "Guidance",
  consensus: "Consensus",
  assumption: "Assumption",
  inference: "Inference",
};

export function KindTag({ kind }: { kind: EvidenceKind }) {
  const tone =
    kind === "reported" ? "border-teal/30 text-teal-deep" : kind === "guidance" || kind === "consensus" ? "border-gold/50 text-[#7a5a22]" : "border-rule-strong text-muted";
  return (
    <span className={`inline-block rounded-[5px] border px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.07em] ${tone}`}>{LABEL[kind]}</span>
  );
}
