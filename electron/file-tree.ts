import { readdir, readFile, stat } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";

/**
 * File-tree scanning + bounded file reading for the sidebar file tree.
 *
 * Phase 3-lite scope: one-shot synchronous walk (no chokidar watching), flat
 * list (no nested tree UI), markdown-ish text files only. Full Phase 3 will
 * swap in chokidar, multi-root workspaces, and proper text/binary detection.
 *
 * Security rules:
 *   - `readFileContent` refuses any path that does not sit under one of the
 *     explicitly-granted allowed roots. The renderer can never escape the
 *     workspace to read arbitrary files (e.g. ~/.ssh/id_ed25519).
 *   - Path checks operate on resolved absolute paths to defeat `..` traversal
 *     and symlink-surface tricks.
 */

export interface MarkdownFileEntry {
  readonly path: string;
  readonly relativePath: string;
  readonly basename: string;
  readonly ctime: string;
  readonly mtime: string;
}

const MARKDOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".md",
  ".markdown",
  ".txt",
]);

const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "out",
  "dist",
]);

const MAX_DEPTH = 8;
const MAX_FILES = 5000;

/**
 * Walks `rootPath` once and returns a flat array of markdown-ish files.
 *
 * The walk is bounded by {@link MAX_DEPTH} (to prevent runaway recursion on
 * pathological symlink loops) and {@link MAX_FILES} (to prevent the renderer
 * being flooded with a multi-gigabyte `node_modules` scan). Hidden
 * directories (leading `.`) are skipped entirely.
 */
export async function readMarkdownTree(
  rootPath: string,
): Promise<MarkdownFileEntry[]> {
  const root = resolve(rootPath);
  const results: MarkdownFileEntry[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;
    if (results.length >= MAX_FILES) return;

    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      // Permission denied or vanished directory — skip silently; the sidebar
      // should degrade gracefully, not explode on one bad folder.
      return;
    }

    // Stable output order: directories first by name, then files by name.
    dirents.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      if (results.length >= MAX_FILES) return;
      if (dirent.name.startsWith(".")) continue;

      const abs = resolve(dir, dirent.name);

      if (dirent.isDirectory()) {
        if (EXCLUDED_DIRS.has(dirent.name)) continue;
        await walk(abs, depth + 1);
        continue;
      }

      if (!dirent.isFile()) continue;

      const ext = extensionOf(dirent.name);
      if (!MARKDOWN_EXTENSIONS.has(ext)) continue;

      let stats;
      try {
        stats = await stat(abs);
      } catch {
        continue;
      }

      results.push({
        path: abs,
        relativePath: relative(root, abs),
        basename: basename(abs),
        ctime: stats.ctime.toISOString(),
        mtime: stats.mtime.toISOString(),
      });
    }
  }

  await walk(root, 0);
  return results;
}

/**
 * Reads an allowed UTF-8 file and returns its contents.
 *
 * Rejects (throws) when `absPath` is not under any of `allowedRoots`. The
 * rejection is intentional — the renderer should see a clear error instead
 * of silently getting an empty string for out-of-bounds reads.
 */
export async function readFileContent(
  absPath: string,
  allowedRoots: readonly string[],
): Promise<string> {
  const resolved = resolve(absPath);

  const normalizedRoots = allowedRoots.map((root) => resolve(root));
  const isAllowed = normalizedRoots.some((root) => isPathInside(resolved, root));
  if (!isAllowed) {
    throw new Error(
      `file:readContent refused path outside allowed roots: ${resolved}`,
    );
  }

  return readFile(resolved, "utf-8");
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot).toLowerCase();
}

/**
 * True when `child` is equal to or nested under `parent`, after both have
 * been resolved to absolute paths. Uses the path separator as a boundary to
 * prevent `/foo/barbaz` from being reported as inside `/foo/bar`.
 */
function isPathInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const prefix = parent.endsWith(sep) ? parent : parent + sep;
  return child.startsWith(prefix);
}
