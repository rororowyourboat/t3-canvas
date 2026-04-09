import { app, ipcMain } from "electron";
import {
  getPersistencePaths,
  loadCanvasSnapshot,
  saveCanvasSnapshot,
} from "./persistence.js";

/**
 * IPC surface exposed to the renderer via the preload contextBridge.
 *
 * Channel naming convention: `<scope>:<action>` — lets us grep for all handlers
 * for a given scope (e.g. all canvas:* handlers) and keeps the namespace flat.
 */

export const IPC_CHANNELS = {
  canvasLoadSnapshot: "canvas:loadSnapshot",
  canvasSaveSnapshot: "canvas:saveSnapshot",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export function registerIpcHandlers(): void {
  const paths = getPersistencePaths({ isDev: !app.isPackaged });

  ipcMain.handle(IPC_CHANNELS.canvasLoadSnapshot, async () => {
    return loadCanvasSnapshot(paths);
  });

  ipcMain.handle(IPC_CHANNELS.canvasSaveSnapshot, async (_event, snapshot: unknown) => {
    await saveCanvasSnapshot(paths, snapshot);
  });
}
