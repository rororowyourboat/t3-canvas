import { useLayoutEffect, useMemo, useState } from "react";
import { throttle } from "lodash-es";
import {
  Tldraw,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  getSnapshot,
  loadSnapshot as loadTldrawSnapshot,
  createShapeId,
  type Editor,
  type TLEditorSnapshot,
} from "tldraw";
import { AgentShapeUtil } from "./shapes/AgentShapeUtil";

// Store must know about every shape + binding type in the schema (including
// defaults) so migrations line up. The Tldraw component only needs our custom
// shapes — it merges with its own defaults internally.
const customShapeUtils = [AgentShapeUtil];
const allShapeUtils = [...defaultShapeUtils, ...customShapeUtils];

type LoadingState = "loading" | "ready" | "error";

function App() {
  const store = useMemo(
    () => createTLStore({ shapeUtils: allShapeUtils, bindingUtils: defaultBindingUtils }),
    [],
  );
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");

  useLayoutEffect(() => {
    let disposed = false;

    void window.t3canvas.loadSnapshot().then((snapshot) => {
      if (disposed) return;
      if (snapshot) {
        try {
          loadTldrawSnapshot(store, snapshot as TLEditorSnapshot);
        } catch (err) {
          console.error("[spike] snapshot load failed", err);
          setLoadingState("error");
          return;
        }
      }
      setLoadingState("ready");
    });

    const unlisten = store.listen(
      throttle(() => {
        const snapshot = getSnapshot(store);
        void window.t3canvas.saveSnapshot(snapshot).catch((err) => {
          console.error("[spike] save failed", err);
        });
      }, 500),
    );

    return () => {
      disposed = true;
      unlisten();
    };
  }, [store]);

  if (loadingState === "loading") {
    return <Splash label="Loading canvas…" />;
  }

  if (loadingState === "error") {
    return <Splash label="Failed to load canvas state. Check console." />;
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw store={store} shapeUtils={customShapeUtils} onMount={handleMount} />
    </div>
  );
}

function handleMount(editor: Editor) {
  // Only seed initial shapes on an empty canvas (first launch).
  const existing = editor.getCurrentPageShapes();
  if (existing.length > 0) return;

  const frameA = createShapeId();
  const frameB = createShapeId();
  const agentA = createShapeId();
  const agentB = createShapeId();

  // Create frames first so children can parent to them.
  editor.createShapes([
    {
      id: frameA,
      type: "frame",
      x: 100,
      y: 100,
      props: { w: 700, h: 500, name: "Migration Team" },
    },
    {
      id: frameB,
      type: "frame",
      x: 900,
      y: 100,
      props: { w: 700, h: 500, name: "Research Squad" },
    },
  ]);

  // Child shapes inside a frame use coordinates relative to the frame's origin.
  // Agent B uses a data: URL to side-step X-Frame-Options blocks and to let you
  // type into a form inside the iframe to verify interactivity end-to-end.
  const agentBSrcdoc = `<!doctype html><html><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#222"><h1 style="margin:0 0 8px;font-size:20px">Agent Tile B</h1><p style="margin:0 0 16px;color:#666">Inline HTML via <code>srcdoc</code>. If the input below accepts focus and keystrokes, iframe interactivity is working.</p><input type="text" placeholder="type here to test…" style="width:calc(100% - 20px);padding:10px;border:1px solid #ccc;border-radius:6px;font-size:14px" autofocus /><button style="margin-top:12px;padding:8px 14px;border:1px solid #888;border-radius:6px;background:#fff;cursor:pointer">And a button</button></body></html>`;

  editor.createShapes([
    {
      id: agentA,
      type: "agent",
      parentId: frameA,
      x: 60,
      y: 80,
      props: { w: 560, h: 380, url: "https://example.com" },
    },
    {
      id: agentB,
      type: "agent",
      parentId: frameB,
      x: 60,
      y: 80,
      props: { w: 560, h: 380, url: `srcdoc:${agentBSrcdoc}` },
    },
  ]);

  editor.zoomToFit();
}

function Splash({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#666",
        fontSize: 14,
      }}
    >
      {label}
    </div>
  );
}

export default App;
