/**
 * Server-side configuration. Reads environment variables once and never
 * echoes secret values. Import only from server code.
 */

export type AppMode = "live" | "demo";

const PARALLEL_BASE_URL = "https://api.parallel.ai";

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function getConfig() {
  const parallelKey = read("PARALLEL_API_KEY");
  const anthropicKey = read("ANTHROPIC_API_KEY");
  const live = Boolean(parallelKey && anthropicKey);
  return {
    mode: (live ? "live" : "demo") as AppMode,
    hasParallelKey: Boolean(parallelKey),
    hasAnthropicKey: Boolean(anthropicKey),
    parallel: {
      baseUrl: read("PARALLEL_BASE_URL") ?? PARALLEL_BASE_URL,
      apiKey: parallelKey,
      processorQuick: read("THESIS_PARALLEL_PROCESSOR_QUICK") ?? "core",
      processorDeep: read("THESIS_PARALLEL_PROCESSOR_DEEP") ?? "pro",
    },
    synthesis: {
      model: read("THESIS_SYNTHESIS_MODEL") ?? "claude-opus-5-5",
      effort: (read("THESIS_SYNTHESIS_EFFORT") ?? "medium") as "low" | "medium" | "high",
      /** Upper bound on evidence characters passed to the synthesis model. */
      maxEvidenceChars: Number(read("THESIS_MAX_EVIDENCE_CHARS") ?? 36_000),
    },
    rateLimit: {
      perMinute: Number(read("THESIS_RATE_LIMIT_PER_MINUTE") ?? 6),
    },
  };
}

/** What the browser is allowed to know about configuration. Never includes secrets. */
export function publicConfig() {
  const c = getConfig();
  return {
    mode: c.mode,
    missing: [
      ...(c.hasParallelKey ? [] : ["PARALLEL_API_KEY"]),
      ...(c.hasAnthropicKey ? [] : ["ANTHROPIC_API_KEY"]),
    ],
    processors: { quick: c.parallel.processorQuick, deep: c.parallel.processorDeep },
    synthesisModel: c.synthesis.model,
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;
