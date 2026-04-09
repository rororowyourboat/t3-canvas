import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

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

/**
 * Phase 4 wire types. Mirrors `PtyDataEvent` / `PtyExitEvent` / `PtySpawnResult`
 * in `electron/ipc.ts` and `electron/pty-host.ts`. Same rationale as
 * {@link MarkdownFileEntry}: the preload bundle can't reach across to the
 * main-process TypeScript, so we re-declare and re-export via `T3CanvasApi`.
 */
export interface PtySpawnResult {
  readonly sessionId: string;
  readonly pid: number;
  readonly cwd: string;
}

export interface PtySpawnOptions {
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
  readonly shell?: string;
}

export interface PtyDataEvent {
  readonly sessionId: string;
  readonly data: string;
}

export interface PtyExitEvent {
  readonly sessionId: string;
  readonly exitCode: number;
  readonly signal?: number;
}

type PtyDataListener = (sessionId: string, data: string) => void;
type PtyExitListener = (
  sessionId: string,
  exitCode: number,
  signal?: number,
) => void;

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
  pty: {
    spawn: (opts: PtySpawnOptions): Promise<PtySpawnResult> =>
      ipcRenderer.invoke("pty:spawn", opts),
    write: (sessionId: string, data: string): Promise<void> =>
      ipcRenderer.invoke("pty:write", sessionId, data),
    resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke("pty:resize", sessionId, cols, rows),
    kill: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke("pty:kill", sessionId),
    /**
     * Subscribe to every `pty:data` broadcast. The listener receives events
     * for ALL sessions — the caller is responsible for filtering by its own
     * `sessionId`. Returns an unsubscribe function that removes exactly the
     * handler we attached.
     */
    onData: (listener: PtyDataListener): (() => void) => {
      const handler = (_event: IpcRendererEvent, payload: PtyDataEvent): void => {
        listener(payload.sessionId, payload.data);
      };
      ipcRenderer.on("pty:data", handler);
      return () => {
        ipcRenderer.removeListener("pty:data", handler);
      };
    },
    /** Same fan-out pattern as {@link onData} but for exit events. */
    onExit: (listener: PtyExitListener): (() => void) => {
      const handler = (_event: IpcRendererEvent, payload: PtyExitEvent): void => {
        listener(payload.sessionId, payload.exitCode, payload.signal);
      };
      ipcRenderer.on("pty:exit", handler);
      return () => {
        ipcRenderer.removeListener("pty:exit", handler);
      };
    },
  },
} as const;

contextBridge.exposeInMainWorld("t3canvas", api);

export type T3CanvasApi = typeof api;
