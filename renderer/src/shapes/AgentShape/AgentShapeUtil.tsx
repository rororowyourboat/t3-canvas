import { useState, type CSSProperties } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  useEditor,
  type RecordProps,
} from "tldraw";
import { NewAgentDialog } from "./NewAgentDialog";
import { agentShapeMigrations } from "./migrations";
import {
  AGENT_SHAPE_TYPE,
  agentShapeProps,
  type TLAgentShape,
} from "./types";

/**
 * Shape util for the agent tile. See PLAN.md § "Phase 2 — Agent Shape MVP"
 * and § "tldraw patterns we will follow" for the rationale behind each
 * override below.
 *
 * Integration responsibilities of this file:
 *   - Declare the static `type`, `props`, and `migrations` that tldraw uses
 *     to build its schema. `props` comes from `./types.ts` so the validator
 *     and the `TLGlobalShapePropsMap` augmentation can't drift.
 *   - Implement `getDefaultProps` — called when `editor.createShape` is
 *     invoked without explicit props (e.g. from the "convert to shape" menu
 *     tldraw exposes). Our tool always supplies full props, but defaults are
 *     still required.
 *   - Render the tile: a header (emoji + title) above either the T3 Code
 *     iframe or the new-agent dialog, depending on whether the shape has
 *     been configured. Both states live in one `component()` so tldraw's
 *     regular render pipeline keeps the dialog in sync with store state.
 *
 * Phase 2 constraint checklist:
 *   - [x] `pointerEvents: "all"` on the HTMLContainer
 *   - [x] `e.stopPropagation()` on every interactive child (header button,
 *         iframe, dialog inputs — the dialog handles its own stopPropagation
 *         internally)
 *   - [x] `canEdit = false`, `canResize = true`, `isAspectRatioLocked = false`
 *   - [x] `static migrations = agentShapeMigrations`
 *   - [x] Strict TS — no `any`, no unused parameters
 */
export class AgentShapeUtil extends BaseBoxShapeUtil<TLAgentShape> {
  static override type = AGENT_SHAPE_TYPE;

  static override props: RecordProps<TLAgentShape> = agentShapeProps;

  static override migrations = agentShapeMigrations;

  override getDefaultProps(): TLAgentShape["props"] {
    return {
      w: 520,
      h: 640,
      t3ServerUrl: "",
      environmentId: "",
      threadId: "",
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

  override component(shape: TLAgentShape) {
    // React rule: hooks can't go inside a class method that doesn't render
    // directly. We render through a function component so `useEditor` and
    // `useState` (for dialog visibility) behave correctly.
    return <AgentShapeView shape={shape} />;
  }

  override indicator(shape: TLAgentShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers — kept in the same file so there's only one entry point
// for the shape util, but extracted from the class to use React hooks.
// ---------------------------------------------------------------------------

function AgentShapeView({ shape }: { readonly shape: TLAgentShape }) {
  const editor = useEditor();
  // `showDialog` is user intent, not store state — it lives in component
  // state so reopening the dialog from the header doesn't persist as a shape
  // property (which would be silly to serialize to disk).
  const [showDialog, setShowDialog] = useState(false);

  const isConfigured =
    shape.props.t3ServerUrl.length > 0 &&
    shape.props.environmentId.length > 0 &&
    shape.props.threadId.length > 0;

  // Auto-open the dialog for fresh, unconfigured tiles so the user doesn't
  // have to hunt for a "configure" affordance right after placing the tile.
  const dialogOpen = showDialog || !isConfigured;

  const title = shape.props.autoTitle?.trim()
    ? shape.props.autoTitle
    : deriveFallbackTitle(shape.props.environmentId);

  return (
    <HTMLContainer
      style={containerStyle(shape.props.w, shape.props.h)}
      // Tldraw shape containers default to pointer-events: none. We flip it
      // on for the whole tile because both the header AND the iframe content
      // need to receive native events.
    >
      <AgentHeader
        title={title}
        canOpenDialog={isConfigured}
        onOpenDialog={() => setShowDialog(true)}
      />

      <div style={bodyStyle}>
        {isConfigured ? (
          <iframe
            src={buildEmbedUrl(shape.props)}
            style={iframeStyle}
            // Stop canvas gestures when the user drags / clicks inside the
            // embedded thread. Without this tldraw will try to pan the
            // canvas when the pointer goes down over the iframe.
            onPointerDown={(e) => e.stopPropagation()}
            title={title}
          />
        ) : (
          <UnconfiguredPlaceholder />
        )}
      </div>

      {dialogOpen ? (
        <NewAgentDialog
          editor={editor}
          shape={shape}
          onSubmitted={() => setShowDialog(false)}
        />
      ) : null}
    </HTMLContainer>
  );
}

function AgentHeader({
  title,
  canOpenDialog,
  onOpenDialog,
}: {
  readonly title: string;
  readonly canOpenDialog: boolean;
  readonly onOpenDialog: () => void;
}) {
  // The header is BOTH the drag handle AND the dialog reopen trigger.
  // We use `onClick` (not `onPointerDown`) so the native "click" semantics
  // — pointerdown + pointerup without movement — naturally distinguishes
  // a click (open dialog) from a drag (move shape). Drag pointerdowns
  // propagate to tldraw unimpeded because there's no onPointerDown handler
  // here at all. A click that doesn't move fires onClick, which is where
  // we open the dialog.
  //
  // The click handler still stops propagation because a full click cycle
  // on a shape's child also fires tldraw's own click handler which would
  // try to enter edit mode; we want the dialog to be the only effect.
  return (
    <div
      style={headerStyle}
      onClick={(e) => {
        if (!canOpenDialog) return;
        e.stopPropagation();
        onOpenDialog();
      }}
      role={canOpenDialog ? "button" : undefined}
      title={canOpenDialog ? "Reconfigure this agent" : undefined}
    >
      <span aria-hidden>🤖</span>
      <span style={headerTitleStyle}>{title}</span>
    </div>
  );
}

function UnconfiguredPlaceholder() {
  return (
    <div style={placeholderStyle}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Configure this agent</div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
        Point it at a T3 Code thread to embed a live conversation.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function buildEmbedUrl(props: TLAgentShape["props"]): string {
  // `minimal=1` tells T3 Code's /embed/thread route to drop its chrome. The
  // route itself lives in the separate t3code repo; this URL is the public
  // contract between the two apps in Phase 2.
  return `${props.t3ServerUrl}/embed/thread/${props.environmentId}/${props.threadId}?minimal=1`;
}

function deriveFallbackTitle(environmentId: string): string {
  if (!environmentId) return "agent";
  return `agent · ${environmentId.slice(0, 6)}`;
}

// ---------------------------------------------------------------------------
// Styles — inline per PLAN.md § Phase 2 ("Style inline for now").
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
    border: "1px solid var(--color-divider, #d0d3d9)",
    borderRadius: 8,
    backgroundColor: "var(--color-panel, #ffffff)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  };
}

const headerStyle: CSSProperties = {
  flex: "0 0 auto",
  padding: "8px 12px",
  borderBottom: "1px solid var(--color-divider, #e5e5e5)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text, #222)",
  backgroundColor: "var(--color-panel-contrast, #f6f7f9)",
  cursor: "pointer",
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

const iframeStyle: CSSProperties = {
  flex: "1 1 auto",
  width: "100%",
  height: "100%",
  border: "none",
};

const placeholderStyle: CSSProperties = {
  flex: "1 1 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
  color: "var(--color-muted, #6b7280)",
};
