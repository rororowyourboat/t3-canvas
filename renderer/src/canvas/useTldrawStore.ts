import { useLayoutEffect, useMemo, useState } from "react";
import { throttle } from "lodash-es";
import {
  createTLStore,
  getSnapshot,
  loadSnapshot as loadTldrawSnapshot,
  type TLEditorSnapshot,
  type TLStore,
} from "tldraw";
import { allBindingUtils, allShapeUtils } from "./shape-registry";

export type TldrawStoreLoadingState = "loading" | "ready" | "error";

export interface UseTldrawStoreResult {
  readonly store: TLStore;
  readonly loading: TldrawStoreLoadingState;
}

const SAVE_THROTTLE_MS = 500;

/**
 * Creates the tldraw store, loads a persisted snapshot over IPC, and wires a
 * throttled save listener so every change is persisted back to disk.
 *
 * Pattern matches `tldraw.dev/examples/local-storage` but with the browser
 * localStorage read/write swapped for Electron IPC → Node fs atomic write.
 *
 * Rules locked in (per fork/REFERENCES.md and PLAN.md § tldraw patterns):
 *   - Pass the FULL union of default + custom shape/binding utils to
 *     createTLStore so migrations resolve. Passing custom alone corrupts the
 *     schema because the arrow binding migration depends on the arrow shape
 *     migration which is in defaults.
 *   - 500ms throttle matches tldraw docs' recommended default.
 *   - useLayoutEffect (not useEffect) so the snapshot loads synchronously
 *     before the Tldraw component first renders — prevents a "flash of empty
 *     canvas" on launch.
 *   - Save both `document` and `session` (the full snapshot) so camera,
 *     selection, and UI state survive restart. Agent-template's single-user
 *     pattern.
 */
export function useTldrawStore(): UseTldrawStoreResult {
  const store = useMemo(
    () =>
      createTLStore({
        shapeUtils: allShapeUtils,
        bindingUtils: allBindingUtils,
      }),
    [],
  );

  const [loading, setLoading] = useState<TldrawStoreLoadingState>("loading");

  useLayoutEffect(() => {
    let disposed = false;

    void window.t3canvas.canvas.loadSnapshot().then((snapshot) => {
      if (disposed) return;
      if (snapshot) {
        try {
          loadTldrawSnapshot(store, snapshot as TLEditorSnapshot);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[t3-canvas] snapshot load failed", err);
          setLoading("error");
          return;
        }
      }
      setLoading("ready");
    });

    const persist = throttle(() => {
      const snapshot = getSnapshot(store);
      void window.t3canvas.canvas.saveSnapshot(snapshot).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[t3-canvas] snapshot save failed", err);
      });
    }, SAVE_THROTTLE_MS);

    const unlisten = store.listen(persist);

    return () => {
      disposed = true;
      unlisten();
      persist.cancel();
    };
  }, [store]);

  return { store, loading };
}
