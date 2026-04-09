import { FileTree } from "./FileTree";

/**
 * Sidebar layout: "Workspace" header + scrollable file tree body.
 *
 * Phase 3-lite: the tree is hardcoded to one workspace root and shows a
 * flat list of markdown files. Drag a row onto the canvas to create a
 * FileShape (drop handler registered in `Canvas.tsx` on merge).
 */
export function Sidebar() {
  return (
    <aside className="app-sidebar" aria-label="Workspace sidebar">
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-divider, #e5e5e5)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text, #222)",
          flex: "0 0 auto",
        }}
      >
        Workspace
      </header>
      <FileTree />
    </aside>
  );
}
