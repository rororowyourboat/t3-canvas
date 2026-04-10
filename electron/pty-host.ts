import { randomUUID } from "node:crypto";
import * as pty from "node-pty";
import type { IPty } from "node-pty";

/**
 * PTY host — a thin, main-process-only manager of `node-pty` sessions.
 *
 * Design (see PLAN.md § Phase 4):
 *   - Sessions are keyed by a UUID generated in `spawn`. The renderer never
 *     talks to `node-pty` directly; it only holds session ids and posts
 *     through the IPC surface in {@link import("./ipc.js")}.
 *   - Data and exit events are fanned out through module-local listener
 *     sets so `electron/ipc.ts` can subscribe once at startup and broadcast
 *     to every BrowserWindow without the PTY host knowing anything about
 *     Electron. Keeping Electron out of this module means the host is unit-
 *     testable with a plain Node runner.
 *   - The renderer does its own filtering by `sessionId`, so we broadcast
 *     every data/exit event to every window — no per-window bookkeeping.
 *
 * Non-goals for Phase 4 (documented here so they don't creep in):
 *   - No cross-restart persistence. PTYs die with the main process.
 *   - No "detached session reattach" UI. The map clears on `killAll`.
 *   - No shell detection beyond the platform default + an explicit override.
 */

/** Wire shape for `spawn` — returned to the renderer via the preload bridge. */
export interface PtySpawnResult {
  readonly sessionId: string;
  readonly pid: number;
  readonly cwd: string;
}

/** Options for {@link PtyHost.spawn}. */
export interface PtySpawnOptions {
  readonly cwd: string;
  readonly cols?: number;
  readonly rows?: number;
  /**
   * Override the shell binary. Falls back to a platform default when unset
   * (see {@link defaultShell}) — we intentionally do NOT use
   * `process.env.SHELL` as the only source, because that env var is often
   * missing in headless launches and would block spawning entirely.
   */
  readonly shell?: string;
}

type DataListener = (sessionId: string, data: string) => void;
type ExitListener = (
  sessionId: string,
  exitCode: number,
  signal?: number,
) => void;

/**
 * Resolve the shell to spawn when the caller didn't provide one.
 *
 * Order:
 *   1. Explicit `shell` arg (handled by the caller)
 *   2. `$SHELL` env var if present (gives the user their login shell)
 *   3. Platform default: bash on *nix, PowerShell on Windows
 *
 * We keep `/bin/bash` as the absolute fallback rather than `sh` because the
 * acceptance criteria is "a real bash session" and almost every dev box the
 * app will run on has bash available.
 */
function defaultShell(): string {
  if (process.platform === "win32") {
    return process.env["COMSPEC"] ?? "powershell.exe";
  }
  const envShell = process.env["SHELL"];
  if (envShell && envShell.length > 0) return envShell;
  return "/bin/bash";
}

/**
 * Manager for all active PTY sessions.
 *
 * Exposed as a module-level singleton (see {@link ptyHost} at the bottom of
 * the file) — only the main process instantiates it, and only once.
 */
export class PtyHost {
  private readonly sessions = new Map<string, IPty>();
  private readonly dataListeners = new Set<DataListener>();
  private readonly exitListeners = new Set<ExitListener>();

  /**
   * Spawn a new PTY session at `cwd` and register its data/exit handlers to
   * fan out to every currently subscribed listener.
   *
   * The returned `sessionId` is the only handle callers use for every
   * subsequent operation.
   */
  spawn(opts: PtySpawnOptions): PtySpawnResult {
    const cols = opts.cols ?? 80;
    const rows = opts.rows ?? 24;
    const shell = opts.shell ?? defaultShell();

    // `node-pty` swallows an invalid cwd with an opaque ENOENT from deep in
    // the native layer. Let the caller see the failure surface early.
    const proc = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: opts.cwd,
      env: { ...process.env } as { [key: string]: string },
    });

    const sessionId = randomUUID();
    this.sessions.set(sessionId, proc);

    proc.onData((data) => {
      for (const listener of this.dataListeners) {
        listener(sessionId, data);
      }
    });

    proc.onExit(({ exitCode, signal }) => {
      for (const listener of this.exitListeners) {
        listener(sessionId, exitCode, signal);
      }
      // Drop the session from the map once it exits. Callers that still hold
      // the id will get a no-op on `write` / `resize` / `kill` and can clean
      // up their side of the bookkeeping from the `exit` event.
      this.sessions.delete(sessionId);
    });

    return { sessionId, pid: proc.pid, cwd: opts.cwd };
  }

  /**
   * Forward keyboard input (or any string, really) to the session. No-ops if
   * the session has already exited or was never registered — this keeps the
   * IPC surface forgiving of races between an `exit` event and a pending
   * `write` from the renderer.
   */
  write(sessionId: string, data: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) return;
    proc.write(data);
  }

  /** Propagate an xterm resize to the underlying pty. */
  resize(sessionId: string, cols: number, rows: number): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) return;
    // `node-pty` throws if either dimension is <= 0; clamp to 1 to keep the
    // renderer's `fit()` edge cases (e.g. a 0-height tile mid-drag) harmless.
    proc.resize(Math.max(1, cols), Math.max(1, rows));
  }

  /**
   * Terminate the session. The `onExit` handler registered in {@link spawn}
   * is still responsible for removing the entry from the map, so we don't
   * call `sessions.delete` here.
   */
  kill(sessionId: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) return;
    try {
      proc.kill();
    } catch {
      // `kill` throws on Windows when signals aren't supported and can
      // throw on *nix if the process is already gone. Either way the
      // `exit` handler will run and drop the session.
    }
  }

  /**
   * Subscribe to every data frame from every session. The returned function
   * unsubscribes. Implementation note: we keep one `onData` handler per
   * IPty (attached in `spawn`) that fans out to the *current* set of
   * subscribers — so a subscriber registered after `spawn` still receives
   * later frames from that session without any rewiring.
   */
  onPtyData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  /** Same pattern as {@link onPtyData} but for exit events. */
  onPtyExit(listener: ExitListener): () => void {
    this.exitListeners.add(listener);
    return () => {
      this.exitListeners.delete(listener);
    };
  }

  /**
   * Kill every active session. Called from the main process's
   * `before-quit` hook so we don't leave orphaned shell processes behind.
   */
  killAll(): void {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.kill(sessionId);
    }
  }
}

/**
 * Process-wide singleton. Import this from `electron/ipc.ts` and from the
 * main entry (`electron/index.ts`) — do NOT construct a second `PtyHost`.
 */
export const ptyHost = new PtyHost();
