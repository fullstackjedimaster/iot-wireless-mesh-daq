// /ui-daq/src/lib/selection.ts
"use client";
import { useEffect } from "react";

export function useBroadcastSelectedTarget(id: string, attrs?: Record<string, unknown>) {
  useEffect(() => {
    if (!id) return;
    window.postMessage({ type: "TARGET_SELECTED", id, attrs: attrs ?? null, source: "daq-ui" }, "*");
  }, [id, attrs]);
}
