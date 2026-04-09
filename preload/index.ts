import { contextBridge, ipcRenderer } from "electron";

/**
 * Typed IPC bridge exposed as `window.t3canvas` to the renderer.
 *
 * Keep this surface small and typed. Every new channel added to
 * `electron/ipc.ts` must also be added here, and the matching type declared
 * in `renderer/src/types/global.d.ts`.
 */
const api = {
  canvas: {
    loadSnapshot: (): Promise<unknown> => ipcRenderer.invoke("canvas:loadSnapshot"),
    saveSnapshot: (snapshot: unknown): Promise<void> =>
      ipcRenderer.invoke("canvas:saveSnapshot", snapshot),
  },
} as const;

contextBridge.exposeInMainWorld("t3canvas", api);

export type T3CanvasApi = typeof api;
