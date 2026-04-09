import { T, type RecordProps, type TLBaseShape } from "tldraw";

/**
 * FileShape — a canvas tile that renders a file from disk.
 *
 * Phase 3-lite: only `kind: "note"` is implemented (a rendered markdown
 * body). Phase 3-full adds `"code"` (Monaco) and `"image"` variants —
 * those live as a string literal union so the migration story is trivial
 * when we light them up.
 */

export const FILE_SHAPE_TYPE = "file" as const;

/**
 * String literal union of supported file kinds. Only `"note"` is routed
 * to a real renderer in this phase; the type is kept open so future
 * variants don't require a props migration.
 */
export type FileShapeKind = "note";

/**
 * Augment tldraw's global shape props map so `TLShape<"file">` resolves to
 * this shape's props everywhere (e.g. `editor.createShape`, store typings).
 *
 * This is the pattern locked in by PLAN.md § tldraw patterns §1.
 */
declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [FILE_SHAPE_TYPE]: {
      w: number;
      h: number;
      filePath: string;
      kind: FileShapeKind;
    };
  }
}

export type TLFileShape = TLBaseShape<
  typeof FILE_SHAPE_TYPE,
  {
    w: number;
    h: number;
    filePath: string;
    kind: FileShapeKind;
  }
>;

/**
 * T validator schema. Runtime-enforced by tldraw on load — NOT just TS.
 * Matches the augmented {@link TLGlobalShapePropsMap} entry above.
 */
export const fileShapeProps: RecordProps<TLFileShape> = {
  w: T.number,
  h: T.number,
  filePath: T.string,
  kind: T.literalEnum("note"),
};
