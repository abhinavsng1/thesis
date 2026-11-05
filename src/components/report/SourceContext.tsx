"use client";

import { createContext, useContext } from "react";
import type { Source } from "@/lib/schema/report";

export interface SourceContextValue {
  sources: Map<string, Source>;
  open: (id: string) => void;
}

export const SourceContext = createContext<SourceContextValue>({ sources: new Map(), open: () => {} });

export function useSources() {
  return useContext(SourceContext);
}
