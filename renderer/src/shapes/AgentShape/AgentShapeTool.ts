import { StateNode, createShapeId } from "tldraw";
import { AGENT_SHAPE_TYPE, type TLAgentShape } from "./types";

/**
 * The click-to-create tool for agent tiles.
 *
 * Flow (per PLAN.md § Phase 2):
 *   1. User picks the tool from the toolbar (or hits its kbd shortcut — wired
 *      in `ui-overrides.tsx` on merge).
 *   2. `onEnter` swaps the cursor to the "cross" reticle so it's visually
 *      distinct from the select tool.
 *   3. On `onPointerDown`, the tool creates an agent shape at the pointer
 *      location with ALL ids blank. That blank state tells the shape util's
 *      `component()` to render `NewAgentDialog` on top of the tile so the
 *      user can fill in the ids; confirming the dialog flips the shape into
 *      its embed state, cancelling deletes the placeholder.
 *   4. The new shape is selected and we hop back to the select tool so the
 *      user can immediately move / resize it.
 *
 * The 520x640 dimensions match the default in PLAN.md § "Custom shape class
 * layout". We offset by (-260, -320) so the shape centers on the pointer,
 * which feels more natural than "top-left corner at cursor".
 *
 * Rules honored (PLAN.md § Phase 2 constraints):
 *   - Uses the `AGENT_SHAPE_TYPE` constant, not a bare string literal, so
 *     renaming the shape only requires touching `types.ts`.
 *   - Strict TS compliant — no `any`, all props set explicitly.
 */
export class AgentShapeTool extends StateNode {
  static override id = "agent";

  override onEnter(): void {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onPointerDown(): void {
    const { x, y } = this.editor.inputs.getCurrentPagePoint();
    const id = createShapeId();

    this.editor.createShape<TLAgentShape>({
      id,
      type: AGENT_SHAPE_TYPE,
      x: x - 260,
      y: y - 320,
      props: {
        w: 520,
        h: 640,
        // Empty ids → the shape's component renders NewAgentDialog instead
        // of the iframe. The dialog either fills them in or deletes the
        // placeholder shape on cancel.
        t3ServerUrl: "",
        environmentId: "",
        threadId: "",
      },
    });

    this.editor.setSelectedShapes([id]);
    this.editor.setCurrentTool("select");
  }
}
