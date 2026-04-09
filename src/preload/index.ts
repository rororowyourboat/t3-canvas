import { contextBridge, ipcRenderer } from "electron";

const api = {
  loadSnapshot: (): Promise<unknown> => ipcRenderer.invoke("t3canvas:loadSnapshot"),
  saveSnapshot: (snapshot: unknown): Promise<void> =>
    ipcRenderer.invoke("t3canvas:saveSnapshot", snapshot),
} as const;

contextBridge.exposeInMainWorld("t3canvas", api);

export type T3CanvasApi = typeof api;
