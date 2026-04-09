import { app, BrowserWindow, ipcMain } from "electron";
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
import { ptyHost, type PtySpawnResult } from "./pty-host.js";

/**
 * IPC surface exposed to the renderer via the preload contextBridge.
 *
 * Channel naming convention: `<scope>:<action>` — lets us grep for all handlers
 * for a given scope (e.g. all canvas:* handlers) and keeps the namespace flat.
 *
 * Phase 4 added the `pty:*` surface. Unlike the request/response-only `canvas`
 * and `file` scopes, `pty` has TWO broadcast channels (`pty:data`, `pty:exit`)
 * that every renderer window receives — see {@link registerIpcHandlers} below
 * for the fan-out wiring and the contract comment on `ptyHost.onPtyData`.
 */

export const IPC_CHANNELS = {
  canvasLoadSnapshot: "canvas:loadSnapshot",
  canvasSaveSnapshot: "canvas:saveSnapshot",
  fileReadMarkdownTree: "file:readMarkdownTree",
  fileReadContent: "file:readContent",
  ptySpawn: "pty:spawn",
  ptyWrite: "pty:write",
  ptyResize: "pty:resize",
  ptyKill: "pty:kill",
  ptyData: "pty:data",
  ptyExit: "pty:exit",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * Wire payload for the `pty:data` broadcast. The renderer filters by
 * `sessionId` — we don't maintain per-window subscriptions.
 */
export interface PtyDataEvent {
  readonly sessionId: string;
  readonly data: string;
}

/**
 * Wire payload for the `pty:exit` broadcast. `signal` is only set on *nix
 * when the shell was killed by a signal rather than exiting normally.
 */
export interface PtyExitEvent {
  readonly sessionId: string;
  readonly exitCode: number;
  readonly signal?: number;
}

/** Re-export so the preload layer can pin to the same type. */
export type { PtySpawnResult };

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

  // -------------------------------------------------------------------------
  // pty:* — PTY host RPC surface (Phase 4)
  // -------------------------------------------------------------------------

  ipcMain.handle(
    IPC_CHANNELS.ptySpawn,
    async (
      _event,
      opts: { cwd: string; cols: number; rows: number; shell?: string },
    ): Promise<PtySpawnResult> => {
      return ptyHost.spawn(opts);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ptyWrite,
    async (_event, sessionId: string, data: string): Promise<void> => {
      ptyHost.write(sessionId, data);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ptyResize,
    async (
      _event,
      sessionId: string,
      cols: number,
      rows: number,
    ): Promise<void> => {
      ptyHost.resize(sessionId, cols, rows);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ptyKill,
    async (_event, sessionId: string): Promise<void> => {
      ptyHost.kill(sessionId);
    },
  );

  // -------------------------------------------------------------------------
  // pty:* broadcast fan-out
  //
  // Contract: every PTY data/exit event is sent to EVERY BrowserWindow. The
  // renderer registers `window.t3canvas.pty.onData` / `.onExit` listeners and
  // filters by its own sessionId. We intentionally don't keep per-window
  // subscription state because:
  //   1. A session can be "attached" to multiple shape instances across
  //      windows (future phase) without extra plumbing.
  //   2. Windows come and go; walking `getAllWindows()` on each event avoids
  //      stale-reference bugs.
  //   3. Fan-out volume is bounded — a terminal emits O(human typing) data,
  //      not multi-megabyte frames.
  //
  // Subscriptions are registered once at startup and never torn down; the
  // process exits along with them.
  // -------------------------------------------------------------------------

  ptyHost.onPtyData((sessionId, data) => {
    const payload: PtyDataEvent = { sessionId, data };
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      win.webContents.send(IPC_CHANNELS.ptyData, payload);
    }
  });

  ptyHost.onPtyExit((sessionId, exitCode, signal) => {
    const payload: PtyExitEvent = { sessionId, exitCode, signal };
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      win.webContents.send(IPC_CHANNELS.ptyExit, payload);
    }
  });

  // Kill every live pty before the app actually quits so we don't leak
  // shell processes. `before-quit` fires once; no need to guard with `once`.
  app.on("before-quit", () => {
    ptyHost.killAll();
  });
}
