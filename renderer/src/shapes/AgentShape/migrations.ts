import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
} from "tldraw";
import { AGENT_SHAPE_TYPE } from "./types";

/**
 * Agent shape props migrations.
 *
 * Phase 2 ships at v1 — no migrations needed yet because there's no older
 * schema in the wild. The scaffolding exists so Phase 2+ can append entries
 * without touching the shape util. See PLAN.md § "Schema migrations".
 *
 * Rule locked in (PLAN.md): every future props change MUST add a migration.
 * If you rename or remove a prop, add an entry to `agentShapeVersions` and
 * push a `{ id, up, down }` record onto the `sequence` below. `up` migrates
 * old snapshots forward; `down` is optional but lets us export for older
 * clients.
 *
 * Example for v2 — adding a `model` prop later:
 *
 *   export const agentShapeVersions = createShapePropsMigrationIds(
 *     AGENT_SHAPE_TYPE,
 *     { AddModel: 1 },
 *   );
 *
 *   export const agentShapeMigrations = createShapePropsMigrationSequence({
 *     sequence: [
 *       {
 *         id: agentShapeVersions.AddModel,
 *         up(props) { props.model ??= "claude-sonnet-4-5"; },
 *       },
 *     ],
 *   });
 */

// Exported (not just declared) so ESLint / tsc's `noUnusedLocals` is happy
// at v1 and so the next migration can reference `agentShapeVersions.<Name>`
// without introducing a new top-level binding.
export const agentShapeVersions = createShapePropsMigrationIds(
  AGENT_SHAPE_TYPE,
  {},
);

export const agentShapeMigrations = createShapePropsMigrationSequence({
  sequence: [],
});
