"use client";

import { use } from "react";

import { LayerWorkspace } from "@/components/workspace/workspace";

/**
 * The route is thin on purpose: `id` decides which Layer the workspace opens, and
 * a Layer that does not exist renders its own honest state rather than throwing.
 * All real interaction lives in components/workspace.
 */
export default function LayerRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LayerWorkspace layerId={id} />;
}
