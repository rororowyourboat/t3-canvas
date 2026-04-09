import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { randomUUID } from "node:crypto";

/**
 * Persistence root layout:
 *
 *   ~/.t3-canvas/               → production state
 *   ~/.t3-canvas/dev/           → dev mode state (isolated from prod)
 *     canvas-state.json         → tldraw snapshot ({ document, session })
 *     config.json               → app config (workspaces, window, t3code settings)
 *
 * Dev isolation is decided by `app.isPackaged` in the Electron main process
 * and passed through to this module at call time — not inferred here, so the
 * persistence layer stays pure and testable.
 */

export interface PersistencePaths {
  readonly stateDir: string;
  readonly canvasStateFile: string;
  readonly configFile: string;
}

export function getPersistencePaths(options: { isDev: boolean }): PersistencePaths {
  const base = join(homedir(), ".t3-canvas");
  const stateDir = options.isDev ? join(base, "dev") : base;
  return {
    stateDir,
    canvasStateFile: join(stateDir, "canvas-state.json"),
    configFile: join(stateDir, "config.json"),
  };
}

export async function loadCanvasSnapshot(paths: PersistencePaths): Promise<unknown> {
  try {
    const raw = await readFile(paths.canvasStateFile, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCanvasSnapshot(
  paths: PersistencePaths,
  snapshot: unknown,
): Promise<void> {
  await ensureStateDir(paths.stateDir);
  await atomicWrite(paths.canvasStateFile, JSON.stringify(snapshot, null, 2));
}

async function ensureStateDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Atomic write: stage to a temp file in the OS tmpdir, then rename into place.
 * `rename` is atomic within a filesystem on POSIX — on Linux tmpfs → ext4
 * (different filesystems) this degenerates to a copy, which is still safer
 * than writing directly to the target since the target is never partially
 * written.
 */
async function atomicWrite(target: string, contents: string): Promise<void> {
  const tmp = join(tmpdir(), `t3-canvas-${randomUUID()}.json`);
  await writeFile(tmp, contents, "utf-8");
  await rename(tmp, target);
}
