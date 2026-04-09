import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
} from "tldraw";
import { TERMINAL_SHAPE_TYPE } from "./types";

/**
 * Terminal shape props migrations.
 *
 * Phase 4 ships at v1 — no migrations needed yet because there's no older
 * schema in the wild. The scaffolding exists so future phases can append
 * entries without touching the shape util.
 *
 * Rule locked in (PLAN.md § tldraw patterns §5): every future props change
 * MUST add a migration. For example, if we later persist terminal buffer
 * history on the shape itself we'll add a `BufferHistory` version here with
 * `up` / `down` handlers.
 *
 * Example for a hypothetical v2 adding `historyChunks`:
 *
 *   export const terminalShapeVersions = createShapePropsMigrationIds(
 *     TERMINAL_SHAPE_TYPE,
 *     { AddHistoryChunks: 1 },
 *   );
 *
 *   export const terminalShapeMigrations = createShapePropsMigrationSequence({
 *     sequence: [
 *       {
 *         id: terminalShapeVersions.AddHistoryChunks,
 *         up(props) { props.historyChunks ??= []; },
 *       },
 *     ],
 *   });
 */

// Exported (not just declared) so `noUnusedLocals` stays happy at v1 and so
// the next migration has a stable binding to reference by name.
export const terminalShapeVersions = createShapePropsMigrationIds(
  TERMINAL_SHAPE_TYPE,
  {},
);

export const terminalShapeMigrations = createShapePropsMigrationSequence({
  sequence: [],
});
