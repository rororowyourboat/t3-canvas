import { useCallback, type CSSProperties } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  useEditor,
  type RecordProps,
} from "tldraw";
import { Terminal } from "./Terminal";
import { terminalShapeMigrations } from "./migrations";
import {
  TERMINAL_SHAPE_TYPE,
  terminalShapeProps,
  type TLTerminalShape,
} from "./types";

/**
 * Shape util for the terminal tile. See PLAN.md § "Phase 4 — Terminal Shape"
 * and § "tldraw patterns we will follow".
 *
 * Integration responsibilities:
 *   - Declare the static `type`, `props`, and `migrations` for tldraw's
 *     schema. Props come from `./types.ts` so the validator and the
 *     `TLGlobalShapePropsMap` augmentation stay in lockstep.
 *   - Implement `getDefaultProps` — called if `editor.createShape` is
 *     invoked without explicit props. Our tool always supplies them but
 *     defaults are still required by the contract.
 *   - Render a small header (cwd / autoTitle) above an xterm host. When the
 *     shape has no `ptySessionId` yet — which happens briefly while the
 *     tool's spawn roundtrip is in flight — render a placeholder so the
 *     user sees the tile appear immediately.
 *
 * Phase 4 constraint checklist (see task description):
 *   - [x] `pointerEvents: "all"` on the HTMLContainer.
 *   - [x] `stopPropagation` on every interactive child (header + terminal).
 *   - [x] `canEdit = false`, `canResize = true`, `isAspectRatioLocked = false`.
 *   - [x] `static migrations = terminalShapeMigrations`.
 *   - [x] Strict TS — no `any`, no unused locals.
 */
export class TerminalShapeUtil extends BaseBoxShapeUtil<TLTerminalShape> {
  static override type = TERMINAL_SHAPE_TYPE;

  static override props: RecordProps<TLTerminalShape> = terminalShapeProps;

  static override migrations = terminalShapeMigrations;

  override getDefaultProps(): TLTerminalShape["props"] {
    return {
      w: 640,
      h: 400,
      ptySessionId: "",
      cwd: "",
      cols: 80,
      rows: 24,
    };
  }

  override canEdit(): boolean {
    return false;
  }

  override canResize(): boolean {
    return true;
  }

  override isAspectRatioLocked(): boolean {
    return false;
  }

  override component(shape: TLTerminalShape) {
    return <TerminalShapeView shape={shape} />;
  }

  override indicator(shape: TLTerminalShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers — kept in the same file so there's one entry point, but
// extracted from the class so React hooks behave.
// ---------------------------------------------------------------------------

function TerminalShapeView({ shape }: { readonly shape: TLTerminalShape }) {
  const editor = useEditor();

  // Persist the most recent terminal size back onto the shape. We treat the
  // shape as the source of truth for "how big is this terminal" so a
  // reopened tile can re-attach at the same dimensions.
  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (shape.props.cols === cols && shape.props.rows === rows) return;
      editor.updateShape<TLTerminalShape>({
        id: shape.id,
        type: TERMINAL_SHAPE_TYPE,
        props: { cols, rows },
      });
    },
    [editor, shape.id, shape.props.cols, shape.props.rows],
  );

  const headerTitle =
    shape.props.autoTitle?.trim() ||
    (shape.props.cwd ? shortenPath(shape.props.cwd) : "terminal");

  const hasSession = shape.props.ptySessionId.length > 0;

  return (
    <HTMLContainer style={containerStyle(shape.props.w, shape.props.h)}>
      <div
        style={headerStyle}
        onPointerDown={(e) => e.stopPropagation()}
        title={shape.props.cwd || undefined}
      >
        <span aria-hidden>&#x25B8;_</span>
        <span style={headerTitleStyle}>{headerTitle}</span>
      </div>

      <div style={bodyStyle}>
        {hasSession ? (
          <Terminal
            sessionId={shape.props.ptySessionId}
            onResize={handleResize}
          />
        ) : (
          <SpawningPlaceholder />
        )}
      </div>
    </HTMLContainer>
  );
}

function SpawningPlaceholder() {
  return (
    <div style={placeholderStyle}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Spawning…</div>
      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
        Waiting for a PTY session from the main process.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Trim a long absolute path down to something the header can show without
 * eliding every useful segment. We keep the last two segments at most.
 */
function shortenPath(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/).filter((seg) => seg.length > 0);
  if (parts.length <= 2) return trimmed;
  return "…/" + parts.slice(-2).join("/");
}

// ---------------------------------------------------------------------------
// Styles — inline to match the other shape utils in this repo.
// ---------------------------------------------------------------------------

function containerStyle(w: number, h: number): CSSProperties {
  return {
    width: w,
    height: h,
    pointerEvents: "all",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--color-divider, #1f2330)",
    borderRadius: 8,
    backgroundColor: "#0f1117",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
  };
}

const headerStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "6px 10px",
  borderBottom: "1px solid #1f2330",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 600,
  color: "#cbd1df",
  backgroundColor: "#161923",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', monospace",
  userSelect: "none",
};

const headerTitleStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const bodyStyle: CSSProperties = {
  flex: "1 1 auto",
  position: "relative",
  minHeight: 0,
  display: "flex",
};

const placeholderStyle: CSSProperties = {
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
  color: "#8892a6",
};
