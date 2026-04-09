import { Tldraw, createShapeId, type Editor } from "tldraw";
import { customShapeUtils, customTools } from "./shape-registry";
import { components, uiOverrides } from "./ui-overrides";
import { useTldrawStore } from "./useTldrawStore";
import { T3_CANVAS_FILE_DRAG_TYPE } from "../sidebar/FileTree";
import { FILE_SHAPE_TYPE } from "../shapes/FileShape/types";

/**
 * The tldraw canvas host. Owns the persistent store, renders the editor, and
 * wires in our custom shape / tool / UI override registries.
 *
 * Drop handling: when a file is dragged from the sidebar FileTree, it carries
 * T3_CANVAS_FILE_DRAG_TYPE in DataTransfer with the absolute path. We attach
 * a native drop listener to the editor's container in onMount so we can
 * intercept the drop and create a FileShape at the cursor. We do NOT use
 * tldraw's registerExternalContentHandler because its 'files' handler is for
 * OS file drops, not custom in-app drags.
 */

const DEFAULT_FILE_SHAPE_WIDTH = 480;
const DEFAULT_FILE_SHAPE_HEIGHT = 320;

function installFileDropHandler(editor: Editor): () => void {
  const container = editor.getContainer();

  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer) return;
    if (!event.dataTransfer.types.includes(T3_CANVAS_FILE_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent) => {
    if (!event.dataTransfer) return;
    const path = event.dataTransfer.getData(T3_CANVAS_FILE_DRAG_TYPE);
    if (!path) return;
    event.preventDefault();

    const pagePoint = editor.screenToPage({ x: event.clientX, y: event.clientY });
    editor.createShape({
      id: createShapeId(),
      type: FILE_SHAPE_TYPE,
      x: pagePoint.x - DEFAULT_FILE_SHAPE_WIDTH / 2,
      y: pagePoint.y - DEFAULT_FILE_SHAPE_HEIGHT / 2,
      props: {
        w: DEFAULT_FILE_SHAPE_WIDTH,
        h: DEFAULT_FILE_SHAPE_HEIGHT,
        filePath: path,
        kind: "note",
      },
    });
  };

  container.addEventListener("dragover", handleDragOver);
  container.addEventListener("drop", handleDrop);

  return () => {
    container.removeEventListener("dragover", handleDragOver);
    container.removeEventListener("drop", handleDrop);
  };
}

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
      onMount={installFileDropHandler}
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
