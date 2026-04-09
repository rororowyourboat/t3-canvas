import { Tldraw } from "tldraw";
import { customShapeUtils, customTools } from "./shape-registry";
import { components, uiOverrides } from "./ui-overrides";
import { useTldrawStore } from "./useTldrawStore";

/**
 * The tldraw canvas host. Owns the persistent store, renders the editor, and
 * wires in our (currently empty) custom shape / tool / UI override registries.
 *
 * Phase 1 scope: the registries are stubs. Phase 2 adds AgentShapeUtil +
 * AgentTool, Phase 3-lite adds a minimal FileShapeUtil, etc.
 */
export function Canvas() {
  const { store, loading } = useTldrawStore();

  if (loading === "loading") {
    return <CanvasPlaceholder label="Loading canvas…" />;
  }

  if (loading === "error") {
    return <CanvasPlaceholder label="Failed to load canvas state. Check the console." />;
  }

  return (
    <Tldraw
      store={store}
      shapeUtils={customShapeUtils}
      tools={customTools}
      overrides={uiOverrides}
      components={components}
    />
  );
}

function CanvasPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-muted, #888)",
        fontSize: 14,
      }}
    >
      {label}
    </div>
  );
}
