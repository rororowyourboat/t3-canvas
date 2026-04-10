import { StateNode, createShapeId } from "tldraw";
import { TERMINAL_SHAPE_TYPE, type TLTerminalShape } from "./types";

/**
 * Click-to-create tool for terminal tiles.
 *
 * Flow (PLAN.md § Phase 4):
 *   1. User selects the Terminal tool from the toolbar (or its `t` kbd,
 *      wired in `ui-overrides.tsx` on merge).
 *   2. `onEnter` swaps the cursor to a cross reticle.
 *   3. `onPointerDown` does a `pty:spawn` roundtrip to the main process,
 *      gets a real sessionId back, and creates the shape with that id
 *      populated. Selecting the shape + flipping back to `select.idle`
 *      mirrors the AgentShapeTool pattern so the UX is consistent.
 *
 * Spawn race note:
 *   We intentionally AWAIT the spawn before creating the shape. The
 *   alternative — create the shape with an empty sessionId and patch it
 *   later — means the xterm host mounts against nothing, has to tear down,
 *   and then remounts. The empty-sessionId state still exists in the shape
 *   util's render path for robustness (e.g. if a snapshot was persisted
 *   mid-spawn on a future phase) but is not a normal create flow.
 *
 * Workspace cwd:
 *   Hardcoded to the repo root for Phase 4, matching the FileTree hardcode.
 *   Phase 5 replaces this with the workspaces array from the app config.
 *
 * Error handling:
 *   If `pty:spawn` rejects we log to the console and NOOP — no shape is
 *   created and the tool returns to `select`. A future phase will wire
 *   tldraw's toast surface so the user sees the failure.
 */

const DEFAULT_WORKSPACE = "/home/rohan/Documents/Github/personal/t3-canvas";
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 400;

export class TerminalShapeTool extends StateNode {
  static override id = "terminal";

  override onEnter(): void {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onPointerDown(): void {
    const { x, y } = this.editor.inputs.getCurrentPagePoint();
    // Capture the editor here so the async continuation doesn't have to
    // worry about `this` rebinding or the tool being torn down mid-await.
    const editor = this.editor;

    void (async () => {
      try {
        const result = await window.t3canvas.pty.spawn({
          cwd: DEFAULT_WORKSPACE,
          cols: DEFAULT_COLS,
          rows: DEFAULT_ROWS,
        });

        const id = createShapeId();
        editor.createShape<TLTerminalShape>({
          id,
          type: TERMINAL_SHAPE_TYPE,
          // Center the tile on the pointer so "click-here" feels natural.
          x: x - DEFAULT_WIDTH / 2,
          y: y - DEFAULT_HEIGHT / 2,
          props: {
            w: DEFAULT_WIDTH,
            h: DEFAULT_HEIGHT,
            ptySessionId: result.sessionId,
            cwd: result.cwd,
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
          },
        });

        editor.setSelectedShapes([id]);
      } catch (err) {
        // Non-fatal: log and drop the tool back to select so the user can
        // try again. A future phase wires a toast via tldraw's
        // `editor.addToast` when that surface is stable here.
        // eslint-disable-next-line no-console
        console.error("[TerminalShapeTool] pty:spawn failed", err);
      } finally {
        editor.setCurrentTool("select");
      }
    })();
  }
}
