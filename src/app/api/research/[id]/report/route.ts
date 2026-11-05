import { NextResponse, connection } from "next/server";
import { getConfig } from "@/lib/research/config";
import { getJobReport } from "@/lib/research/jobs";
import { isSampleId } from "@/lib/research/samples";
import { errorResponse } from "@/lib/research/http";
import { ResearchRequestSchema } from "@/lib/schema/request";

const ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

/**
 * GET returns the finished report (synthesizing on first call).
 * POST does the same but lets the browser re-supply the original question
 * when this server instance no longer remembers the run (cold start).
 */
async function handle(id: string, hint?: unknown) {
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Invalid job id.", retryable: false }, { status: 400 });
  if (!isSampleId(id) && getConfig().mode !== "live") {
    return NextResponse.json({ error: "Live research is not configured on this deployment.", code: "live_research_disabled", retryable: false }, { status: 503 });
  }
  const parsedHint = hint ? ResearchRequestSchema.partial().safeParse(hint) : undefined;
  try {
    const { report } = await getJobReport(id, parsedHint?.success ? parsedHint.data : undefined);
    return NextResponse.json({ report }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/api/research/[id]/report">) {
  await connection();
  const { id } = await ctx.params;
  return handle(id);
}

export async function POST(req: Request, ctx: RouteContext<"/api/research/[id]/report">) {
  await connection();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => undefined);
  return handle(id, body);
}
