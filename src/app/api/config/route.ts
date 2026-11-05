import { NextResponse } from "next/server";
import { connection } from "next/server";
import { publicConfig } from "@/lib/research/config";
import { listSamples } from "@/lib/research/samples";

export async function GET() {
  await connection();
  return NextResponse.json({ ...publicConfig(), samples: listSamples() }, { headers: { "cache-control": "no-store" } });
}
