import { NextResponse, connection } from "next/server";
import { getConfig } from "@/lib/research/config";
import { getProvider } from "@/lib/research/jobs";
import { isSampleId } from "@/lib/research/samples";
import { errorResponse } from "@/lib/research/http";
import type { ProviderEvent } from "@/lib/research/provider";

/**
 * Live research activity as Server-Sent Events, proxied from the provider and
 * normalized. Only observable provider output is forwarded (plan, searches,
 * sources read, progress, status). Credentials never leave the server.
 */

export const maxDuration = 300;
const ID_RE = /^[A-Za-z0-9_-]{1,120}$/;

export async function GET(req: Request, ctx: RouteContext<"/api/research/[id]/events">) {
  await connection();
  const { id } = await ctx.params;
  if (!ID_RE.test(id) || isSampleId(id)) return NextResponse.json({ error: "No event stream for this id.", retryable: false }, { status: 404 });
  if (getConfig().mode !== "live") {
    return NextResponse.json({ error: "Live research is not configured on this deployment.", code: "live_research_disabled", retryable: false }, { status: 503 });
  }
  const provider = getProvider();
  if (!provider.openEvents) return NextResponse.json({ error: "This provider does not stream progress.", retryable: false }, { status: 404 });

  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());
  // Stop before the platform's function limit so the browser reconnects cleanly.
  const budget = setTimeout(() => controller.abort(), 280_000);

  let upstream: ReadableStream<ProviderEvent>;
  try {
    upstream = await provider.openEvents(id, controller.signal);
  } catch (err) {
    clearTimeout(budget);
    return errorResponse(err);
  }

  const encoder = new TextEncoder();
  const body = upstream.pipeThrough(
    new TransformStream<ProviderEvent, Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode("retry: 3000\n\n"));
      },
      transform(ev, c) {
        c.enqueue(encoder.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
      },
      flush() {
        clearTimeout(budget);
      },
    }),
  );
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
