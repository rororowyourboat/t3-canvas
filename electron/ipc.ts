import { app, ipcMain } from "electron";
import {
  getPersistencePaths,
  loadCanvasSnapshot,
  saveCanvasSnapshot,
} from "./persistence.js";
import {
  readFileContent,
  readMarkdownTree,
  type MarkdownFileEntry,
} from "./file-tree.js";

/**
 * IPC surface exposed to the renderer via the preload contextBridge.
 *
 * Channel naming convention: `<scope>:<action>` — lets us grep for all handlers
 * for a given scope (e.g. all canvas:* handlers) and keeps the namespace flat.
 */

export const IPC_CHANNELS = {
  canvasLoadSnapshot: "canvas:loadSnapshot",
  canvasSaveSnapshot: "canvas:saveSnapshot",
  fileReadMarkdownTree: "file:readMarkdownTree",
  fileReadContent: "file:readContent",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * Whitelist of directories the renderer is allowed to read files from via
 * `file:readContent`. Phase 3-lite hardcodes a single workspace; Phase 5
 * replaces this with the workspaces array from the app config.
 */
const ALLOWED_FILE_ROOTS: readonly string[] = [
  "/home/rohan/Documents/Github/personal/t3-canvas",
];

export function registerIpcHandlers(): void {
  const paths = getPersistencePaths({ isDev: !app.isPackaged });

  ipcMain.handle(IPC_CHANNELS.canvasLoadSnapshot, async () => {
    return loadCanvasSnapshot(paths);
  });

  ipcMain.handle(IPC_CHANNELS.canvasSaveSnapshot, async (_event, snapshot: unknown) => {
    await saveCanvasSnapshot(paths, snapshot);
  });

  ipcMain.handle(
    IPC_CHANNELS.fileReadMarkdownTree,
    async (_event, rootPath: string): Promise<MarkdownFileEntry[]> => {
      return readMarkdownTree(rootPath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.fileReadContent,
    async (_event, absPath: string): Promise<string> => {
      return readFileContent(absPath, ALLOWED_FILE_ROOTS);
    },
  );
}
