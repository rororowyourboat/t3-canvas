import { useState, type CSSProperties, type FormEvent } from "react";
import type { Editor } from "tldraw";
import { AGENT_SHAPE_TYPE, type TLAgentShape } from "./types";

/**
 * Modal form that collects the T3 Code coordinates needed to embed a thread:
 *
 *   - `t3ServerUrl`    — base URL where the local T3 Code server is running
 *   - `environmentId`  — the T3 Code environment (workspace/sandbox) id
 *   - `threadId`       — the thread to embed inside that environment
 *
 * The component is rendered INSIDE the agent shape's `component()` output
 * (see `AgentShapeUtil.tsx`) and is shown whenever the shape is in an
 * "unconfigured" state — i.e. any of the three ids is blank. That keeps the
 * dialog lifetime owned by React (tldraw's shape component re-renders on
 * every store change) without needing a portal or an app-global modal host.
 *
 * Why no design system: PLAN.md § Phase 2 explicitly says "Style inline for
 * now — no design system". We'll replace the styling when Phase 5 polish
 * lands.
 *
 * Phase 2 rules honored here:
 *   - `pointerEvents: "all"` on the root wrapper (parent HTMLContainer also
 *     sets it, but we belt-and-brace any nested interactive region).
 *   - Every pointer-reading event handler calls `stopPropagation()` so
 *     tldraw's canvas doesn't steal drag/select events from form inputs.
 */

export interface NewAgentDialogProps {
  readonly editor: Editor;
  readonly shape: TLAgentShape;
  /**
   * Called after the dialog successfully commits the props update. The util
   * uses this to exit the dialog state — in practice nothing else to do
   * because the shape re-renders via the store.
   */
  readonly onSubmitted?: () => void;
}

const DEFAULT_T3_SERVER_URL = "http://localhost:5176";

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(15, 17, 21, 0.55)",
  backdropFilter: "blur(2px)",
  pointerEvents: "all",
  zIndex: 2,
};

const panelStyle: CSSProperties = {
  width: "min(360px, 90%)",
  padding: 20,
  borderRadius: 10,
  backgroundColor: "var(--color-panel, #ffffff)",
  color: "var(--color-text, #1b1d23)",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  fontSize: 13,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--color-divider, #d0d3d9)",
  fontSize: 13,
  fontFamily: "inherit",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 4,
};

const buttonStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid var(--color-divider, #d0d3d9)",
  backgroundColor: "transparent",
  color: "inherit",
  fontSize: 13,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: "var(--color-primary, #2563eb)",
  borderColor: "var(--color-primary, #2563eb)",
  color: "#ffffff",
};

/**
 * Stop tldraw from treating any pointer-down inside the dialog as a canvas
 * gesture. Also applied to the individual form inputs so clicking / selecting
 * text doesn't drag the agent tile.
 */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function NewAgentDialog({
  editor,
  shape,
  onSubmitted,
}: NewAgentDialogProps) {
  const [t3ServerUrl, setT3ServerUrl] = useState(
    shape.props.t3ServerUrl || DEFAULT_T3_SERVER_URL,
  );
  const [environmentId, setEnvironmentId] = useState(shape.props.environmentId);
  const [threadId, setThreadId] = useState(shape.props.threadId);

  const canSubmit =
    t3ServerUrl.trim().length > 0 &&
    environmentId.trim().length > 0 &&
    threadId.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    editor.updateShape<TLAgentShape>({
      id: shape.id,
      type: AGENT_SHAPE_TYPE,
      props: {
        t3ServerUrl: t3ServerUrl.trim(),
        environmentId: environmentId.trim(),
        threadId: threadId.trim(),
      },
    });
    onSubmitted?.();
  }

  /**
   * Cancel semantics per PLAN.md § Phase 2: if the shape was JUST created
   * with all-empty props, delete it so the user isn't left with a ghost
   * tile. Otherwise (the user opened the dialog on an already-configured
   * shape) we just close without mutating anything.
   */
  function handleCancel() {
    const wasUnconfigured =
      !shape.props.t3ServerUrl &&
      !shape.props.environmentId &&
      !shape.props.threadId;
    if (wasUnconfigured) {
      editor.deleteShape(shape.id);
    }
    onSubmitted?.();
  }

  return (
    <div
      style={overlayStyle}
      onPointerDown={stop}
      onPointerUp={stop}
      onWheel={stop}
    >
      <form
        style={panelStyle}
        onSubmit={handleSubmit}
        onPointerDown={stop}
        aria-label="Configure agent tile"
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>New agent tile</div>
        <p style={{ margin: 0, color: "var(--color-muted, #6b7280)" }}>
          Point this tile at a live T3 Code thread. You can find these ids in
          the T3 Code UI.
        </p>

        <label style={labelStyle}>
          T3 Code server URL
          <input
            style={inputStyle}
            type="url"
            value={t3ServerUrl}
            onChange={(e) => setT3ServerUrl(e.target.value)}
            onPointerDown={stop}
            placeholder={DEFAULT_T3_SERVER_URL}
            autoFocus
          />
        </label>

        <label style={labelStyle}>
          Environment id
          <input
            style={inputStyle}
            type="text"
            value={environmentId}
            onChange={(e) => setEnvironmentId(e.target.value)}
            onPointerDown={stop}
            placeholder="env_..."
          />
        </label>

        <label style={labelStyle}>
          Thread id
          <input
            style={inputStyle}
            type="text"
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            onPointerDown={stop}
            placeholder="thr_..."
          />
        </label>

        <div style={buttonRowStyle}>
          <button
            type="button"
            style={buttonStyle}
            onClick={handleCancel}
            onPointerDown={stop}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={primaryButtonStyle}
            disabled={!canSubmit}
            onPointerDown={stop}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
