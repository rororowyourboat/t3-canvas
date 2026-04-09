import { T, type RecordProps, type TLShape } from "tldraw";

/**
 * AgentShape — a tldraw shape that embeds a live T3 Code thread inside an
 * iframe. See PLAN.md § "Phase 2 — Agent Shape MVP" and § "tldraw patterns we
 * will follow".
 *
 * Why this file is a separate module:
 *   - It lets the tool (`AgentShapeTool.ts`) and the dialog
 *     (`NewAgentDialog.tsx`) import the shape type + type constant without
 *     pulling in the shape util's JSX/React dependencies.
 *   - Keeps the `declare module "tldraw"` augmentation isolated so there's a
 *     single source of truth for the shape's props schema.
 *
 * Rules locked in from PLAN.md:
 *   1. Use T validators for every prop (runtime-checked, persistence-safe).
 *   2. Augment `TLGlobalShapePropsMap` so `editor.createShape`, `updateShape`,
 *      etc. are fully typed across the app.
 *   3. Export one canonical `TLAgentShape` alias via tldraw's `TLShape<K>`
 *      helper instead of re-deriving the shape type locally.
 */

export const AGENT_SHAPE_TYPE = "agent" as const;

/**
 * The props schema for an agent shape. `w` / `h` satisfy tldraw's
 * `TLBaseBoxShape` contract (needed for `BaseBoxShapeUtil`). The rest describe
 * *which* T3 Code thread this tile embeds:
 *
 *   - `t3ServerUrl`    — base URL of the running T3 Code server
 *                        (e.g. "http://localhost:5176"). Empty string means
 *                        the tile was created but not yet configured.
 *   - `environmentId`  — T3 Code environment (workspace / sandbox) id.
 *   - `threadId`       — T3 Code thread id inside that environment.
 *   - `autoTitle`      — optional human label the agent can write back later;
 *                        the tile header falls back to a short derived label
 *                        when this is missing.
 */
export interface TLAgentShapeProps {
  w: number;
  h: number;
  t3ServerUrl: string;
  environmentId: string;
  threadId: string;
  autoTitle?: string;
}

declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [AGENT_SHAPE_TYPE]: TLAgentShapeProps;
  }
}

export type TLAgentShape = TLShape<typeof AGENT_SHAPE_TYPE>;

/**
 * Runtime validators for every prop. tldraw calls these when loading
 * snapshots, so they MUST match `TLAgentShapeProps` exactly — the RecordProps
 * generic parameter enforces that at compile time.
 */
export const agentShapeProps: RecordProps<TLAgentShape> = {
  w: T.number,
  h: T.number,
  t3ServerUrl: T.string,
  environmentId: T.string,
  threadId: T.string,
  autoTitle: T.string.optional(),
};
