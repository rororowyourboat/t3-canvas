import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { randomUUID } from "node:crypto";

const STATE_DIR = join(homedir(), ".t3-canvas-spike");
const STATE_FILE = join(STATE_DIR, "state.json");

export async function loadSnapshot(): Promise<unknown> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: unknown): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const tmp = join(tmpdir(), `t3canvas-spike-${randomUUID()}.json`);
  await writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf-8");
  await rename(tmp, STATE_FILE);
}
