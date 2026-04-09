import type { T3CanvasApi } from "../../../preload";

declare global {
  interface Window {
    /**
     * Typed IPC bridge exposed by `preload/index.ts` via contextBridge.
     * Every channel available here must also be registered on the main side
     * in `electron/ipc.ts` — the two files form a typed pair.
     */
    t3canvas: T3CanvasApi;
  }
}

export {};
