import { Suspense } from "react";
import { connection } from "next/server";
import { Nav } from "@/components/brand/Nav";
import { Home } from "@/components/home/Home";
import { publicConfig } from "@/lib/research/config";
import { listSamples } from "@/lib/research/samples";

/** Mode depends on server environment, so this part renders at request time and streams into the static shell. */
async function HomeShell() {
  await connection();
  const config = publicConfig();
  const samples = listSamples();
  return (
    <>
      <Nav mode={config.mode} />
      <Home config={config} samples={samples} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <HomeShell />
    </Suspense>
  );
}
