import { createShapePropsMigrationSequence } from "tldraw";

/**
 * Migration scaffold for FileShape props.
 *
 * Empty for v1 (Phase 3-lite). When the props schema changes in a future
 * release — e.g. when Phase 3-full adds `"code"` and `"image"` to
 * {@link import("./types").FileShapeKind}, or adds an `editorState` prop —
 * a new entry goes here with both `up` and `down` handlers.
 *
 * Kept as a real module (not inline) so the FileShapeUtil class body stays
 * focused on rendering and so the migration sequence can be tested in
 * isolation later.
 */
export const fileShapeMigrations = createShapePropsMigrationSequence({
  sequence: [],
});
