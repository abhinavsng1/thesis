import { NextResponse, connection } from "next/server";
import { getConfig } from "@/lib/research/config";
import { getJobStatus } from "@/lib/research/jobs";
import { isSampleId } from "@/lib/research/samples";
import { errorResponse } from "@/lib/research/http";

const ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

export async function GET(_req: Request, ctx: RouteContext<"/api/research/[id]">) {
  await connection();
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Invalid job id.", retryable: false }, { status: 400 });
  if (!isSampleId(id) && getConfig().mode !== "live") {
    return NextResponse.json({ error: "Live research is not configured on this deployment.", code: "live_research_disabled", retryable: false }, { status: 503 });
  }
  try {
    const status = await getJobStatus(id);
    return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
