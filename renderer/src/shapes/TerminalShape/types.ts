import { T, type RecordProps, type TLBaseShape } from "tldraw";

/**
 * TerminalShape — a canvas tile that hosts an interactive shell via xterm.js
 * on the renderer and a long-lived `node-pty` session in the main process.
 *
 * See PLAN.md § "Phase 4 — Terminal shape" for the acceptance criteria and
 * § "tldraw patterns we will follow" for the conventions the shape obeys.
 *
 * Why this file is separate from the shape util:
 *   - `TerminalShapeTool.ts` imports the type constant and `TLTerminalShape`
 *     without pulling in React / xterm dependencies.
 *   - The `declare module "tldraw"` augmentation only needs to happen once,
 *     so it lives here (next to the matching T-validator schema).
 *
 * Rules locked in (PLAN.md):
 *   1. Every prop has a runtime T validator — NOT just a TypeScript type.
 *   2. `TLGlobalShapePropsMap` is augmented so `editor.createShape<...>` and
 *      `editor.updateShape<...>` produce fully typed call sites.
 *   3. The sessionId is a *plain string* on the shape (not a branded type)
 *      because tldraw snapshots go through JSON — branding erases anyway.
 */

export const TERMINAL_SHAPE_TYPE = "terminal" as const;

/**
 * Props for a terminal tile.
 *
 *   - `w` / `h`        — BaseBoxShape contract. Shape is resizable.
 *   - `ptySessionId`   — UUID returned from `pty:spawn`. Empty string until
 *                        the shape has been connected to a real session
 *                        (the tool does the spawn roundtrip before creating
 *                        the shape, so this is only briefly empty in error
 *                        paths).
 *   - `cwd`            — working directory the session was spawned in. Used
 *                        as the tile header fallback label.
 *   - `cols` / `rows`  — last known terminal dimensions. We persist these so
 *                        a reopened tile starts with something close to its
 *                        previous size instead of snapping back to 80x24.
 *   - `shell`          — optional, purely informational. Actual shell choice
 *                        lives in the main process at spawn time.
 *   - `autoTitle`      — optional human label; the xterm hosted in the tile
 *                        can write back a title later (e.g. "zsh · ~/src").
 */
export interface TLTerminalShapeProps {
  w: number;
  h: number;
  ptySessionId: string;
  cwd: string;
  cols: number;
  rows: number;
  shell?: string;
  autoTitle?: string;
}

declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [TERMINAL_SHAPE_TYPE]: TLTerminalShapeProps;
  }
}

export type TLTerminalShape = TLBaseShape<
  typeof TERMINAL_SHAPE_TYPE,
  TLTerminalShapeProps
>;

/**
 * Runtime validators for every prop. tldraw calls these when loading
 * snapshots, so they MUST stay in sync with {@link TLTerminalShapeProps}.
 * The `RecordProps<TLTerminalShape>` generic enforces that at compile time.
 */
export const terminalShapeProps: RecordProps<TLTerminalShape> = {
  w: T.number,
  h: T.number,
  ptySessionId: T.string,
  cwd: T.string,
  cols: T.number,
  rows: T.number,
  shell: T.string.optional(),
  autoTitle: T.string.optional(),
};
