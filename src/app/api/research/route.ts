import { NextResponse, connection } from "next/server";
import { ResearchRequestSchema } from "@/lib/schema/request";
import { getConfig } from "@/lib/research/config";
import { createJob } from "@/lib/research/jobs";
import { allow } from "@/lib/research/ratelimit";
import { errorResponse } from "@/lib/research/http";

export async function POST(req: Request) {
  await connection();
  const cfg = getConfig();
  if (cfg.mode !== "live") {
    return NextResponse.json(
      {
        error: "Live research is not configured on this deployment. Open a sample report instead, or set PARALLEL_API_KEY and ANTHROPIC_API_KEY to enable live research.",
        code: "live_research_disabled",
        retryable: false,
      },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON.", retryable: false }, { status: 400 });
  }
  const parsed = ResearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Invalid request.", retryable: false }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`create:${ip}`, cfg.rateLimit.perMinute)) {
    return NextResponse.json({ error: "Too many research requests from this network in the last minute. Please wait a moment.", retryable: true }, { status: 429 });
  }
  const key = req.headers.get("idempotency-key")?.slice(0, 128) || undefined;
  try {
    const job = await createJob(parsed.data, key);
    return NextResponse.json(job, { status: job.reused ? 200 : 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
