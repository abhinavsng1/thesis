import { NextResponse, connection } from "next/server";
import { getConfig } from "@/lib/research/config";
import { getJobReport, JobError, type ReportProgress } from "@/lib/research/jobs";
import { ProviderError } from "@/lib/research/provider";

export const maxDuration = 300;
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
  if (!req.headers.get("accept")?.includes("text/event-stream")) return handle(id, body);

  // Streaming variant: progress events while the report is built, then the report itself.
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Invalid job id.", retryable: false }, { status: 400 });
  if (!isSampleId(id) && getConfig().mode !== "live") {
    return NextResponse.json({ error: "Live research is not configured on this deployment.", code: "live_research_disabled", retryable: false }, { status: 503 });
  }
  const parsedHint = body ? ResearchRequestSchema.partial().safeParse(body) : undefined;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("open", { at: new Date().toISOString() });
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), 15_000);
      try {
        const { report } = await getJobReport(id, parsedHint?.success ? parsedHint.data : undefined, (p: ReportProgress) => send("progress", p));
        send("report", { report });
      } catch (err) {
        const status = err instanceof JobError ? err.status : err instanceof ProviderError ? 502 : 500;
        const message = err instanceof JobError || err instanceof ProviderError ? err.message : "Unexpected server error.";
        const retryable = err instanceof JobError || err instanceof ProviderError ? err.retryable : true;
        send("failed", { error: message, retryable, status });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}
