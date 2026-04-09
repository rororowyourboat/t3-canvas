import { contextBridge, ipcRenderer } from "electron";

/**
 * Typed IPC bridge exposed as `window.t3canvas` to the renderer.
 *
 * Keep this surface small and typed. Every new channel added to
 * `electron/ipc.ts` must also be added here, and the matching type declared
 * in `renderer/src/types/global.d.ts`.
 */

/**
 * A markdown-ish file entry as returned by `file:readMarkdownTree`.
 *
 * Mirror of the `MarkdownFileEntry` in `electron/file-tree.ts`. The preload
 * layer cannot import from `electron/` (different build targets), so this is
 * re-declared here as the wire-format contract and re-exported via the
 * `T3CanvasApi` type so the renderer never has to redefine it.
 */
export interface MarkdownFileEntry {
  readonly path: string;
  readonly relativePath: string;
  readonly basename: string;
  readonly ctime: string;
  readonly mtime: string;
}

const api = {
  canvas: {
    loadSnapshot: (): Promise<unknown> => ipcRenderer.invoke("canvas:loadSnapshot"),
    saveSnapshot: (snapshot: unknown): Promise<void> =>
      ipcRenderer.invoke("canvas:saveSnapshot", snapshot),
  },
  file: {
    readMarkdownTree: (rootPath: string): Promise<MarkdownFileEntry[]> =>
      ipcRenderer.invoke("file:readMarkdownTree", rootPath),
    readContent: (absPath: string): Promise<string> =>
      ipcRenderer.invoke("file:readContent", absPath),
  },
} as const;

contextBridge.exposeInMainWorld("t3canvas", api);

export type T3CanvasApi = typeof api;
