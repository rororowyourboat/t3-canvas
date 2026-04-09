import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { BaseBoxShapeUtil, HTMLContainer } from "tldraw";
import { fileShapeMigrations } from "./migrations";
import { FILE_SHAPE_TYPE, fileShapeProps, type TLFileShape } from "./types";

/**
 * Browser-safe `basename` — Node's `path` module is not available in the
 * renderer and we don't want to pull a polyfill for one function.
 */
function basename(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/**
 * FileShape — renders a tile backed by a file on disk.
 *
 * Phase 3-lite scope:
 *   - Only `kind: "note"` is supported. Content is loaded through the
 *     preload bridge (`window.t3canvas.file.readContent`) and rendered with
 *     `react-markdown`. No editing, no watching, no disk writes.
 *   - Phase 3-full will add `"code"` (Monaco) and `"image"` kinds plus a
 *     save path via the bridge.
 *
 * Locked-in tldraw rules (see PLAN.md § tldraw patterns):
 *   1. T validators on every prop (see `./types`)
 *   2. `declare module "tldraw"` augmentation (see `./types`)
 *   3. `pointerEvents: "all"` on the container and `stopPropagation()` on
 *      the scrolling body so users can scroll the markdown without
 *      initiating a shape drag
 *   4. Migrations live in a sibling file even when empty
 */
export class FileShapeUtil extends BaseBoxShapeUtil<TLFileShape> {
  static override type = FILE_SHAPE_TYPE;

  static override props = fileShapeProps;

  static override migrations = fileShapeMigrations;

  override canEdit(): boolean {
    return false;
  }

  override canResize(): boolean {
    return true;
  }

  override isAspectRatioLocked(): boolean {
    return false;
  }

  override getDefaultProps(): TLFileShape["props"] {
    return {
      w: 420,
      h: 520,
      filePath: "",
      kind: "note",
    };
  }

  override component(shape: TLFileShape) {
    return (
      <HTMLContainer
        style={{
          pointerEvents: "all",
          width: shape.props.w,
          height: shape.props.h,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--color-border, #d4d4d4)",
          borderRadius: 8,
          backgroundColor: "var(--color-background, #ffffff)",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "var(--color-text, #1f1f1f)",
        }}
      >
        <FileShapeBody shape={shape} />
      </HTMLContainer>
    );
  }

  override indicator(shape: TLFileShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}

type LoadState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly content: string }
  | { readonly status: "error"; readonly message: string };

function FileShapeBody({ shape }: { shape: TLFileShape }) {
  const { filePath } = shape.props;
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!filePath) {
      setState({ status: "error", message: "No file path set on this tile." });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    window.t3canvas.file
      .readContent(filePath)
      .then((content) => {
        if (cancelled) return;
        setState({ status: "loaded", content });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const title = filePath ? basename(filePath) : "Untitled";

  return (
    <>
      <div
        style={{
          flex: "0 0 auto",
          padding: "8px 12px",
          borderBottom: "1px solid var(--color-divider, #ececec)",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text, #1f1f1f)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          userSelect: "none",
        }}
        title={filePath}
      >
        {title}
      </div>
      <div
        // Critical: stop pointer events so the markdown body can scroll
        // without the canvas treating drags as shape movement.
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{
          flex: "1 1 auto",
          overflow: "auto",
          padding: "12px 16px",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <FileShapeContent state={state} />
      </div>
    </>
  );
}

function FileShapeContent({ state }: { state: LoadState }) {
  if (state.status === "idle" || state.status === "loading") {
    return (
      <div style={{ color: "var(--color-muted, #888)" }}>Loading…</div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        style={{
          color: "var(--color-danger, #b00020)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        Failed to load file: {state.message}
      </div>
    );
  }

  return <Markdown>{state.content}</Markdown>;
}
