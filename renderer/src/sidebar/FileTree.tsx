import { useEffect, useState } from "react";
import type { MarkdownFileEntry } from "../../../preload";

/**
 * Sidebar file tree — a flat, scrollable list of markdown files under the
 * hardcoded workspace root.
 *
 * Phase 3-lite scope:
 *   - Single hardcoded root (Phase 5 adds multi-workspace switching)
 *   - Flat list (Phase 3-full can add expand/collapse directories)
 *   - Drag source only: the drop handler that creates a FileShape on the
 *     canvas is wired up in `Canvas.tsx` on merge
 *
 * Drag contract:
 *   - DataTransfer sets `application/x-t3canvas-file` to the absolute path
 *     (primary, unambiguous channel for our own drop handler)
 *   - Also sets `text/plain` to the same path as a fallback so pasting into
 *     a text field shows something sensible during debugging
 */

const WORKSPACE_ROOT = "/home/rohan/Documents/Github/personal/t3-canvas";

/**
 * MIME-ish type used on DataTransfer to identify an in-app file drag. The
 * canvas drop handler registered in `Canvas.tsx` (wired on merge) looks
 * for this key to decide whether a drop should create a FileShape.
 */
export const T3_CANVAS_FILE_DRAG_TYPE = "application/x-t3canvas-file";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly entries: readonly MarkdownFileEntry[] }
  | { readonly status: "error"; readonly message: string };

export function FileTree() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    window.t3canvas.file
      .readMarkdownTree(WORKSPACE_ROOT)
      .then((entries) => {
        if (cancelled) return;
        setState({ status: "ready", entries });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
        fontSize: 12,
        color: "var(--color-text, #1f1f1f)",
      }}
    >
      <FileTreeBody state={state} />
    </div>
  );
}

function FileTreeBody({ state }: { state: LoadState }) {
  if (state.status === "loading") {
    return <EmptyMessage>Loading files…</EmptyMessage>;
  }
  if (state.status === "error") {
    return (
      <EmptyMessage tone="danger">
        Failed to read workspace: {state.message}
      </EmptyMessage>
    );
  }
  if (state.entries.length === 0) {
    return <EmptyMessage>No markdown files under the workspace.</EmptyMessage>;
  }
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: "4px 0",
      }}
    >
      {state.entries.map((entry) => (
        <FileTreeRow key={entry.path} entry={entry} />
      ))}
    </ul>
  );
}

function FileTreeRow({ entry }: { entry: MarkdownFileEntry }) {
  return (
    <li>
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData(T3_CANVAS_FILE_DRAG_TYPE, entry.path);
          event.dataTransfer.setData("text/plain", entry.path);
        }}
        title={entry.path}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "6px 16px",
          cursor: "grab",
          borderLeft: "2px solid transparent",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            "var(--color-hover, rgba(0,0,0,0.04))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <span
          style={{
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.basename}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-muted, #888)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.relativePath}
        </span>
      </div>
    </li>
  );
}

function EmptyMessage({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <p
      style={{
        margin: 0,
        padding: "16px",
        color:
          tone === "danger"
            ? "var(--color-danger, #b00020)"
            : "var(--color-muted, #888)",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}
