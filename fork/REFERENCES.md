# t3-canvas — External References

Companion to [PLAN.md](../PLAN.md). Lists the tldraw projects worth consulting, the specific patterns to steal from each, and which phase each reference matters in.

The goal: when we hit a design question during any phase, this doc tells us exactly which repo to grep.

**Rule of thumb:** read patterns from these references, **don't copy code**. Agent-template is MIT so we technically could, but deriving our own code forces us to actually understand the pattern, not just transplant it.

---

## References on disk

| Path | Source | Purpose |
|---|---|---|
| `~/Documents/Github/personal/collab-reference/` | `collaborator-ai/collab-public` (FSL-1.1-ALv2) | Original reason we started this project. Canvas-as-spatial-IDE paradigm, multi-webview per tile, file handling, markdown/code/image tile patterns. **DO NOT copy code — license is restrictive.** Grep for pattern ideas only. |
| `~/Documents/Github/personal/tldraw-agent-template-reference/` | `tldraw/agent-template` (MIT) | Official reference for building AI agents on tldraw. Parts/Actions abstraction, streaming, context assembly, React hooks pattern. Safe to copy from (MIT). |
| `~/Documents/Github/personal/collab-public/` | Original upstream clone | Untouched, for comparison with our `collab-reference` fork. |

---

## Primary reference: `tldraw/agent-template`

**Repo:** https://github.com/tldraw/agent-template
**License:** MIT
**Local:** `~/Documents/Github/personal/tldraw-agent-template-reference/`
**Stack:** tldraw + React + Vite + Cloudflare Workers backend

### Why it matters for us

This is tldraw's own reference implementation of "an AI agent that manipulates a tldraw canvas via chat." It's NOT what we're building directly — we want *many* agent tiles, not one agent controlling the canvas — but **the architecture is the closest thing to a blueprint for the cross-agent awareness layer we need in Phase 5.5 and Phase 6**.

### Structure worth grepping

```
client/
├── AgentHelpers.ts       — coordinate normalization, shape validation, LLM output sanitization
├── App.tsx               — top-level layout with canvas + chat panel split
├── agent/                — TldrawAgent class: prompt(), cancel(), reset(), request()
├── actions/              — AGENT_ACTION_UTILS: 20 declarative action types the agent can perform
├── parts/                — PROMPT_PART_UTILS: 17 context slices the agent perceives each turn
├── modes/                — agent personalities / modes
├── tools/                — custom tldraw tools exposed to the user
└── components/           — chat panel UI, message bubbles, streaming indicators
shared/
├── schema/               — shape schemas shared between client and worker
├── format/               — serialization helpers for over-the-wire context
├── types/                — cross-cut type definitions
└── models.ts             — LLM provider selection/config
worker/                   — Cloudflare Workers backend for LLM calls
```

### Key files to read during Phase 5.5 and Phase 6

| Phase | File to grep | What to learn |
|---|---|---|
| 5.5, 6 | `client/parts/*.ts` | How to model "context" as a composable list of typed utils, not a monolithic prompt |
| 5.5, 6 | `client/parts/PeripheralShapesPartUtil.ts` + `BlurryShapesPartUtil.ts` | LOD representation of other shapes on the canvas — what agents see about other agents |
| 6 | `client/actions/AgentActionUtil.ts` | Base class for declarative agent actions with streaming completion checks |
| 6 | `client/agent/` | The TldrawAgent class API: prompt/cancel/reset/request — shape of the public surface |
| 5.5 | `client/actions/CreateActionUtil.ts` | How streaming wraps shape creation so partial results render as they arrive |
| 6 | `client/parts/TodoListPartUtil.ts` | Agent-owned todo list rendered as canvas state |
| 6 | `client/parts/CanvasLintsPartUtil.ts` | Surfacing issues about the canvas as part of the agent's awareness |
| 5.5 | `client/parts/ScreenshotPartUtil.ts` | `editor.toImage()` pattern for multimodal context |
| 5.5 | `shared/schema/` | Shape schema sharing across client+server |

### The agent-template public API (for matching our useT3Client surface)

```ts
// Inside a component wrapped by TldrawAgentAppProvider
const agent = useAgent()
agent.prompt("Draw a cat")
agent.prompt({ message: "...", bounds: { x, y, w, h } })  // structured input
agent.cancel()                                              // abort current task
agent.reset()                                               // clear memory
agent.request(input)                                        // single non-looping call
```

Our analogue should be:

```ts
// Inside <T3CanvasProvider>
const client = useT3Client()                                  // server health, settings
const thread = useT3Thread(threadId)                          // per-thread state
thread.sendTurn({ text, attachments? })                       // send a turn
thread.interrupt()                                            // cancel current turn
thread.rollback(numTurns)                                     // rewind conversation
```

Same shape, different domain.

---

## Secondary reference: `CarlosPProjects/tldraw-ai`

**Repo:** https://github.com/CarlosPProjects/tldraw-ai
**License:** unlicensed (treat as "all rights reserved" — study only, don't copy)
**Stack:** Next.js 15 + tldraw + OpenAI API + Zustand + Vercel AI SDK

### Why it matters

> "Create custom shapes connected to each other. Automatically transfer context between nodes. AI-generated responses using all related nodes."

This is the **single most important reference for Phase 5.5**: arrow-as-data-pipe pattern. Shapes are nodes, arrows between them are semantic bindings that carry context from upstream to downstream. When agent A produces output, any agent B with an incoming arrow from A gets A's output injected into its context window.

### Key pattern: tldraw's binding system

tldraw has a native binding system (used internally by arrows pointing at shapes). Bindings have `fromId`, `toId`, `type`, and custom props. We register our own `BindingUtil` for a "context-pipe" binding type and query the editor for bindings when assembling an agent's context:

```ts
const incomingPipes = editor.getBindingsToShape(agentShapeId, "context-pipe")
const upstreamShapes = incomingPipes.map(b => editor.getShape(b.fromId))
const upstreamOutputs = upstreamShapes.map(s => s?.meta.lastOutput)
```

### What to read during Phase 5.5

- `src/editor/` and `src/components/` — how they wire their custom node shapes and connections
- README YouTube link: https://youtu.be/rX-jBUNelSs — walkthrough
- Their `next.config.ts` — any tldraw-specific build flags worth copying

---

## Tertiary reference: `tldraw Computer` (product, not code)

**Product:** https://computer.tldraw.com (visual programming with natural language)
**Release:** Dec 2024, powered by Gemini 2.0

Not a code reference — we can't read the source. But the **UX paradigm** is worth studying:

- **Transparency as a feature**: "A tldraw canvas program is transparent — you see how it works as it runs." We want this for agent workflows: the arrows and tiles ARE the program, visible while it executes.
- **Natural language + node graph**: nodes describe intent in plain English, wires describe data flow. Our agent tiles already do the first part; Phase 5.5 adds the second.

### Where it informs us

| Phase | Insight |
|---|---|
| 5.5 | Arrows should visibly animate when data flows through them (not just static) |
| 5 (polish) | A "running" vs "idle" visual state on every agent tile — match tldraw Computer's lit-up node style |

---

## Tertiary reference: `tldraw/make-real`

**Pattern:** screenshot a shape → vision LLM → render result back inside a shape.

Not relevant to our core flow (we don't turn sketches into code), but worth knowing:
- `editor.toImage({ shapes: [shape], format: "png" })` is the canonical way to capture a tile's current visual state
- Gives us a tool for "take a snapshot of another tile's content as context for this tile" — could power "agent B reads agent A's rendered output visually, not textually"

Future feature candidate for Phase 6+, not a core phase requirement.

---

## Production apps on tldraw showcase (UX ideas only, no source access)

From https://tldraw.dev/showcase — 13 featured apps. Ranked by relevance to us:

| App | Relevance | What to steal |
|---|---|---|
| **BigPi.ai** | ⭐⭐⭐ closest to our vision | "AI-native workspace" combining charts, RFPs, docs. Visual workspace with heterogeneous shape types, each doing real work. Study their public-facing demos for agent-workbench UX cues. |
| **Legend Keeper** | ⭐⭐ cross-linked content | Worldbuilding tool: characters, lore, maps linked on canvas. Gives us patterns for "tile A references tile B" without tight coupling. |
| **Jam** | ⭐⭐ context capture | Bug reporting with captured screenshots + context. Analogous to "pin this tile's current state as a context item for another tile." |
| **AI.ai** | ⭐⭐ content-adaptive blocks | "Smart blocks that adapt to content" — shape chrome/size/layout reacts to what's inside. Worth stealing for file tiles that auto-size to their content. |
| **Mobbin** | ⭐ content management patterns | Internal visual content management. General tldraw-as-workbench pattern. |
| **Padlet Sandbox** | ⭐ rapid development | Case study on shipping fast with tldraw. Meta-insight only. |
| **ClickUp / Genio / Aries / Dirac / Matilda / Pollination / GrowTherapy** | — | Domain-specific, less transferable |

---

## Pattern → phase mapping (quick lookup)

When building each phase, consult these references in this order:

| Phase | Primary | Secondary | Specific file(s) to grep |
|---|---|---|---|
| 0 (spike) | tldraw docs — custom shapes, frames, persistence | — | `tldraw.dev/sdk-features/shapes` + `default-shapes` |
| 1 (skeleton) | tldraw docs — `createTLStore`, `@tanstack/router-plugin` | — | `tldraw.dev/examples/local-storage` |
| 2 (agent shape) | collab-reference for multi-webview pattern | — | grep `webview-factory.js` in collab-reference |
| 3 (file shapes) | collab-reference for file watching, frontmatter | tldraw docs — `registerExternalAssetHandler` | `collab-reference/collab-electron/src/main/*watcher*` |
| 4 (terminal) | collab-reference for node-pty host pattern | wezterm docs for PTY edge cases | `collab-reference/collab-electron/src/main/pty.ts` |
| 5 (polish) | collab-reference for settings, keyboard shortcuts | tldraw docs — `TLUiOverrides`, `KeyboardShortcutsDialog` | both |
| **5.5 (cross-agent arrows)** | **`CarlosPProjects/tldraw-ai`** | tldraw binding docs | `src/editor/` in tldraw-ai + tldraw.dev/sdk-features/bindings |
| **6 (agent awareness)** | **`tldraw/agent-template`** | — | `client/parts/*`, `client/actions/AgentActionUtil.ts`, `client/agent/` |

---

## What NOT to copy (and why)

| Source | Thing to avoid | Reason |
|---|---|---|
| collab-reference | Vanilla JS canvas in `shell/renderer.js` | We replaced that entire layer with tldraw |
| collab-reference | Multi-webview-per-tile architecture | Heavy on memory. tldraw's single React tree with custom shapes is lighter and gives us the same isolation via shape boundaries |
| collab-reference | Any code at all | FSL-1.1 license prevents commercial derivative use — safer to derive our own |
| agent-template | The "one agent controls the canvas" paradigm | We want many agents AS tiles, not one agent manipulating tiles |
| tldraw Computer | The visual-programming wire-every-node pattern | That's their product; we use arrows selectively for context pipes, not as the primary interface |

---

## Reading discipline

Before starting any non-spike phase:
1. Open this doc and read the "phase mapping" row for that phase
2. Clone / re-sync the reference if it's moved
3. Grep the specific files listed — don't read whole repos
4. Derive our own implementation from the pattern, don't paste code
5. If a pattern turns out to be wrong for our case, update this doc with the "learned" note

This keeps PLAN.md clean (implementation) and REFERENCES.md focused (research lookup).
