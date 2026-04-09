/**
 * Sidebar placeholder.
 *
 * Phase 1: static "Workspace" header + the TODO chip. Just proves the
 * split-pane layout works and we have somewhere to mount the file tree next.
 *
 * Phase 3-lite will replace this with a real file tree component that lets
 * users drag files onto the canvas.
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
        }}
      >
        Workspace
      </header>
      <div
        style={{
          flex: "1 1 auto",
          padding: "16px",
          color: "var(--color-muted, #888)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <p style={{ margin: 0 }}>
          File tree lands in Phase 3 — drag files from here onto the canvas.
        </p>
      </div>
    </aside>
  );
}
