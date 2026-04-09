import {
  defaultBindingUtils,
  defaultShapeUtils,
  type TLAnyBindingUtilConstructor,
  type TLAnyShapeUtilConstructor,
  type TLStateNodeConstructor,
} from "tldraw";

/**
 * Central registry for every custom shape, tool, and binding the app adds on
 * top of tldraw's defaults. Each phase of the PLAN adds entries here:
 *
 *   Phase 2       → AgentShapeUtil, AgentShapeTool
 *   Phase 3-lite  → FileShapeUtil (markdown-only), FileShapeTool
 *   Phase 3-full  → CodeEditor / ImageView variants of FileShape
 *   Phase 4       → TerminalShapeUtil, TerminalShapeTool
 *   Phase 5.5     → ContextPipeBindingUtil, ContextPipeTool
 *
 * **Do not mutate these arrays at runtime.** tldraw's store schema is built
 * from them at editor creation time — adding a shape util after createTLStore
 * has no effect and can corrupt persistence.
 *
 * The `allShapeUtils` / `allBindingUtils` exports combine defaults + custom
 * and are what `createTLStore` must receive. Passing only `customShapeUtils`
 * to the store breaks because tldraw's built-in arrow binding migration
 * depends on the arrow shape migration (from defaults).
 */

export const customShapeUtils: TLAnyShapeUtilConstructor[] = [];
export const customTools: TLStateNodeConstructor[] = [];
export const customBindingUtils: TLAnyBindingUtilConstructor[] = [];

export const allShapeUtils: TLAnyShapeUtilConstructor[] = [
  ...defaultShapeUtils,
  ...customShapeUtils,
];

export const allBindingUtils: TLAnyBindingUtilConstructor[] = [
  ...defaultBindingUtils,
  ...customBindingUtils,
];
