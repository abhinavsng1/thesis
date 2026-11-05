import { NextResponse } from "next/server";
import { JobError } from "./jobs";
import { ProviderError } from "./provider";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof JobError) {
    return NextResponse.json({ error: err.message, retryable: err.retryable }, { status: err.status });
  }
  if (err instanceof ProviderError) {
    return NextResponse.json({ error: err.message, retryable: err.retryable }, { status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502 });
  }
  // Never leak internal error text.
  console.error("[thesis] unhandled", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "Unexpected server error.", retryable: true }, { status: 500 });
}
