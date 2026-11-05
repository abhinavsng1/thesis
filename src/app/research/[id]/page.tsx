import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Nav } from "@/components/brand/Nav";
import { Workspace } from "@/components/workspace/Workspace";
import { publicConfig } from "@/lib/research/config";
import { getSampleReport, isSampleId } from "@/lib/research/samples";

export async function generateMetadata({ params }: PageProps<"/research/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (isSampleId(id)) {
    const r = getSampleReport(id);
    if (r) return { title: r.title, description: r.stance };
  }
  return { title: "Research" };
}

async function WorkspaceShell({ params }: { params: PageProps<"/research/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const config = publicConfig();
  return (
    <>
      <Nav mode={config.mode} />
      <Workspace id={id} mode={config.mode} />
    </>
  );
}

export default function Page({ params }: PageProps<"/research/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <WorkspaceShell params={params} />
    </Suspense>
  );
}
