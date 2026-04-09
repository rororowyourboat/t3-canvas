# t3-canvas — Implementation Plan (Rebuild Edition)

**Status:** draft 2 — supersedes the fork-based draft 1
**Date:** 2026-04-10
**Direction:** build from scratch using **tldraw** (canvas) + **Electron** (shell), not fork collab-public
**Target integration:** `rororowyourboat/t3code` (MIT, personal fork) running as a separate process
**Reference:** keep the existing `collab-public` clone read-only for pattern lookups

> **What changed from draft 1?** Research into tldraw revealed that the hardest category of work (infinite canvas + custom shapes + **frames** + persistence + pan/zoom + shape clipping + undo/redo) is a solved problem in tldraw. Forking Collaborator would mean navigating ~3300 LOC of vanilla JS canvas code to add features tldraw provides out of the box. Rebuilding from scratch with tldraw results in **fewer total lines owned**, a cleaner mental model, and fewer architectural constraints. Research on Tauri surfaced Linux stability issues (#13157 glitchy canvas, #12463 AppImage missing libs, #11988 cross-distro AppImages, WebKitGTK 6.0 migration in flight) so we stay on Electron.

---

## Vision (unchanged)

A canvas-first workbench for AI coding agents. Infinite pan-zoom canvas where:
- **Agent tiles** render T3 Code sessions as first-class spatial objects
- **File tiles** let you drag files from a workspace onto the canvas (note/code/image)
- **Frames** cluster agents into named teams ("migration squad", "research")
- **All state persists locally** in `~/.t3-canvas/` (JSON via tldraw snapshots)

No accounts, no cloud, no telemetry. Just your agents and your work on a spatial surface.

---

## Why rebuild instead of fork

### The numbers

| | Fork collab-public | Rebuild with tldraw |
|---|---|---|
| New code to write | ~1600 LOC | ~1700 LOC |
| Existing code to navigate | ~3300 LOC vanilla JS canvas | 0 LOC |
| **Total owned** | **~4900 LOC** | **~1700 LOC** |
| Frame clustering (our Phase 2) | ~850 LOC hand-rolled | **0 LOC (native tldraw shape)** |
| Persistence | Custom atomic JSON writes | `getSnapshot`/`loadSnapshot` |
| Pan/zoom/grid snap/resize | Inherit from Collaborator | Inherit from tldraw |
| Undo/redo | Not implemented in Collaborator | Free from tldraw |
| License | FSL-1.1-ALv2 (no commercial) | Apache-2.0 (tldraw) + MIT (all others) |
| Desktop binary | Electron ~200 MB | Electron ~200 MB |

### tldraw gives us, for free

The research validated every capability we need:

- **Custom shapes with React components** — `BaseBoxShapeUtil` subclass renders any React tree inside `HTMLContainer`, including interactive forms and iframes (`dangerously-html` example, `my-interactive-shape` example)
- **Embed shape for iframes** — tldraw has a dedicated `EmbedShape` + `CustomEmbedDefinition` API literally designed for hosting external web services inside shapes. This is our agent tile in one line.
- **Native frame shape** — `editor.createShape({ type: 'frame', props: { w, h, name, color } })`. Children are clipped to bounds, move with parent, have an optional header and colored border. `FrameShapeUtil.configure({ showColors, resizeChildren })` tunes it.
- **Shape clipping** — automatic for children inside frames
- **Snapshot persistence** — `getSnapshot(store)` → `{ document, session }` JSON, `loadSnapshot(store, data)` to restore. Swap localStorage for Node `fs.writeFile` via Electron IPC.
- **Schema migrations** — `createShapePropsMigrationIds` + `createShapePropsMigrationSequence` handle schema evolution as our shapes' props change
- **Custom tools** — `StateNode` subclass + `onPointerDown` handles click-to-create workflows
- **UI overrides** — `TLUiOverrides` and `TLComponents` customize toolbar, menus, keyboard shortcuts without re-implementing the whole UI
- **Asset handling** — `registerExternalAssetHandler` processes dropped files into shape assets
- **Undo/redo, selection, multi-select, copy/paste, export** — all built in

### Why not Tauri

Wanted the 15x binary size reduction. Research surfaced blockers for *our specific use case*:

- `tauri-apps/tauri#13157` — glitchy canvas rendering bug on Linux, closed as "not_planned"
- `tauri-apps/tauri#12463` — AppImage missing `libwebkit2gtkinjectedbundle.so`
- `tauri-apps/tauri#11988` — AppImages built on one distro don't work on another
- `tauri-apps/tauri#14684` — GTK4/WebKitGTK 6.0 migration actively in flight (= instability)
- **Multi-webview marked "unstable"** in Tauri v2 official docs — our agent tiles would rely on this
- Reddit thread (2025-04) on canvas rendering performance under WebKitGTK
- `tauri-plugin-pty` exists (25K downloads) but has 18 GitHub stars and one maintainer vs `node-pty` (10M+ weekly npm downloads, used by VS Code, Hyper, WezTerm)

For a **canvas-heavy Linux-first personal tool with terminal tiles**, Electron's maturity wins. Revisit Tauri when we (a) have a stable app on Electron and (b) want to distribute broadly where 200 MB matters.

---

## Repo strategy

Three directories on disk after this plan is approved:

```
~/Documents/Github/personal/
├── collab-public/              # original clone, completely untouched (reference)
├── collab-reference/           # renamed from current t3-canvas (ex-fork, read-only reference)
│   └── fork/PLAN.md            # this file, committed on fork/main
└── t3-canvas/                  # NEW — fresh rebuild repo (to be created after plan approval)
    ├── electron/               # main process
    ├── renderer/               # React SPA with tldraw
    └── PLAN.md                 # this file moves here once repo exists
```

**Why keep `collab-reference` around?** To `grep` for patterns when we need to know "how did Collaborator handle X?" — particularly file watching, multi-workspace, markdown rendering, image preview. We'll port *ideas* from there to our implementation but not *code*. Having the repo locally means we can read it without re-cloning.

**Why not start rebuild in the same directory?** We'd be deleting `collab-electron/` which is 500+ MB of node_modules plus 100+ MB of source we can still learn from. The rename is cheap and reversible.

**Git strategy for the new repo:**
- Initialize fresh, no shared history with collab-public
- First commit: the initial Electron + Vite + tldraw skeleton
- Commit PLAN.md alongside the skeleton
- No GitHub origin until we explicitly decide to push
- Branch pattern: `main` for working changes, feature branches for anything non-trivial

---

## tldraw patterns we will follow

Documented best practices from tldraw's docs — these are the rules we commit to upfront so we don't drift.

### 1. Custom shape class layout

Every custom shape follows this template:

```tsx
// renderer/shapes/AgentShape/AgentShapeUtil.tsx
import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T, TLShape } from 'tldraw'

const AGENT_SHAPE_TYPE = 'agent' as const

// Augment tldraw's global shape map so TypeScript knows our type
declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [AGENT_SHAPE_TYPE]: {
      w: number
      h: number
      threadId: string
      t3ServerUrl: string
      provider: 'codex' | 'claudeAgent'
      model?: string
    }
  }
}

export type IAgentShape = TLShape<typeof AGENT_SHAPE_TYPE>

export class AgentShapeUtil extends BaseBoxShapeUtil<IAgentShape> {
  static override type = AGENT_SHAPE_TYPE

  // T validators — NOT just TypeScript types. Runtime-validated at load.
  static override props: RecordProps<IAgentShape> = {
    w: T.number,
    h: T.number,
    threadId: T.string,
    t3ServerUrl: T.string,
    provider: T.literalEnum('codex', 'claudeAgent'),
    model: T.string.optional(),
  }

  // Schema migrations live here when props change across releases
  // static override migrations = agentShapeMigrations

  getDefaultProps(): IAgentShape['props'] {
    return {
      w: 520,
      h: 640,
      threadId: '',
      t3ServerUrl: 'http://localhost:8765',
      provider: 'claudeAgent',
    }
  }

  override canEdit() { return false }
  override canResize() { return true }
  override isAspectRatioLocked() { return false }

  component(shape: IAgentShape) {
    return (
      <HTMLContainer
        style={{
          pointerEvents: 'all',  // required — shapes are pointer-events: none by default
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          backgroundColor: 'var(--color-background)',
        }}
      >
        <iframe
          src={`${shape.props.t3ServerUrl}/embed/thread/${shape.props.threadId}?minimal=1`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          // Stop canvas from handling events that happen inside the iframe
          onPointerDown={(e) => e.stopPropagation()}
        />
      </HTMLContainer>
    )
  }

  indicator(shape: IAgentShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
  }
}
```

**Rules locked in:**
1. **One shape util per folder**: `shapes/<ShapeName>/ShapeUtil.tsx` + `ShapeTool.ts` + `types.ts` + `migrations.ts`
2. **Always use T validators** for props — never rely on TypeScript types alone; tldraw uses them at runtime for schema validation and persistence safety
3. **Declare the shape's type in `TLGlobalShapePropsMap`** — gives us full type safety across `editor.createShape`, `updateShape`, etc.
4. **Interactive content inside shapes** always needs `pointerEvents: 'all'` on the container and `e.stopPropagation()` on event handlers inside
5. **Write migrations alongside the shape util** when we ship v2+ of any shape's props schema
6. **Keep shape arrays outside components** to avoid re-renders:
   ```ts
   // In renderer/canvas/shape-registry.ts
   export const customShapeUtils = [AgentShapeUtil, FileShapeUtil, TerminalShapeUtil, ...]
   export const customTools = [AgentTool, FileTool, TerminalTool, ...]
   ```

### 2. Custom tools (click-to-create workflow)

Every tile type gets a custom tool so users can click the toolbar button then click the canvas to place a shape. Pattern:

```tsx
// renderer/shapes/AgentShape/AgentShapeTool.ts
import { StateNode, TLPointerEventInfo, createShapeId } from 'tldraw'

export class AgentShapeTool extends StateNode {
  static override id = 'agent'

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown(info: TLPointerEventInfo) {
    // Open the "new agent" dialog, then create the shape when the user confirms.
    // For MVP we can skip the dialog and just create a default agent tile at the pointer.
    const { x, y } = this.editor.inputs.getCurrentPagePoint()
    const id = createShapeId()
    this.editor.createShape({
      id,
      type: 'agent',
      x: x - 260,
      y: y - 320,
      props: {
        threadId: '',   // placeholder; filled by the dialog or on mount
        t3ServerUrl: this.editor.getInstanceState().meta.t3ServerUrl as string,
        provider: 'claudeAgent',
      },
    })
    // Select the new shape and return to the select tool
    this.editor.setSelectedShapes([id])
    this.editor.setCurrentTool('select')
  }
}
```

### 3. UI overrides (toolbar + menus)

Custom tools appear in the toolbar via `TLUiOverrides` + `TLComponents`. Template:

```tsx
// renderer/canvas/ui-overrides.tsx
import {
  DefaultToolbar, DefaultToolbarContent, TLComponents, TLUiOverrides,
  TldrawUiMenuItem, useIsToolSelected, useTools,
} from 'tldraw'

export const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.agent = {
      id: 'agent',
      icon: 'agent',  // see custom assetUrls below
      label: 'Agent',
      kbd: 'g',
      onSelect: () => editor.setCurrentTool('agent'),
    }
    tools.file = { id: 'file', icon: 'file', label: 'File', kbd: 'f', onSelect: () => editor.setCurrentTool('file') }
    tools.terminal = { id: 'terminal', icon: 'terminal', label: 'Terminal', kbd: 't', onSelect: () => editor.setCurrentTool('terminal') }
    return tools
  },
}

export const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools()
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools.agent} isSelected={useIsToolSelected(tools.agent)} />
        <TldrawUiMenuItem {...tools.file} isSelected={useIsToolSelected(tools.file)} />
        <TldrawUiMenuItem {...tools.terminal} isSelected={useIsToolSelected(tools.terminal)} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    )
  },
}
```

### 4. Frames — use the native one, don't reinvent

Creating a frame:
```ts
editor.createShape({
  type: 'frame',
  x: 100, y: 100,
  props: { w: 1000, h: 700, name: 'Migration Team', color: 'blue' },
})
```

Configure once at mount via `FrameShapeUtil.configure()`:
```ts
import { FrameShapeUtil } from 'tldraw'

const configuredFrameUtil = FrameShapeUtil.configure({
  showColors: true,        // colored borders + headers
  resizeChildren: false,   // resizing the frame doesn't scale children
})

// Pass it in shapeUtils alongside our custom shapes:
export const customShapeUtils = [configuredFrameUtil, AgentShapeUtil, FileShapeUtil, ...]
```

**We do NOT write any frame code.** Drag-shapes-into-frame, move-as-unit, clip-to-bounds, colored headers — all free.

### 5. Persistence — `createTLStore` + throttled listener, Electron IPC backend

Pattern, adapted for Electron instead of localStorage:

```tsx
// renderer/canvas/useTldrawStore.ts
import { throttle } from 'lodash-es'
import { useLayoutEffect, useMemo, useState } from 'react'
import { createTLStore, getSnapshot, loadSnapshot } from 'tldraw'
import { customShapeUtils } from './shape-registry'

export function useTldrawStore() {
  const store = useMemo(() => createTLStore({ shapeUtils: customShapeUtils }), [])
  const [loading, setLoading] = useState<'loading' | 'ready' | 'error'>('loading')

  useLayoutEffect(() => {
    let disposed = false

    // Load via IPC on mount
    window.t3canvas.loadSnapshot().then((snapshot) => {
      if (disposed) return
      if (snapshot) {
        try {
          loadSnapshot(store, snapshot)
        } catch (e) {
          console.error('snapshot load failed', e)
          setLoading('error')
          return
        }
      }
      setLoading('ready')
    })

    // Save via IPC on changes, throttled
    const unlisten = store.listen(
      throttle(() => {
        const snapshot = getSnapshot(store)
        window.t3canvas.saveSnapshot(snapshot)
      }, 500),
    )

    return () => { disposed = true; unlisten() }
  }, [store])

  return { store, loading }
}
```

Electron side:
```ts
// electron/persistence.ts
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

const STATE_DIR = join(homedir(), '.t3-canvas')
const STATE_FILE = join(STATE_DIR, 'canvas-state.json')

export async function loadSnapshot() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf-8'))
  } catch { return null }
}

export async function saveSnapshot(snapshot: unknown) {
  await mkdir(STATE_DIR, { recursive: true })
  const tmp = join(tmpdir(), `t3canvas-${randomUUID()}.json`)
  await writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf-8')
  await rename(tmp, STATE_FILE)   // atomic-ish on linux
}
```

**Rules locked in:**
1. Always use `createTLStore` with explicit `shapeUtils` — pass the same array as the `Tldraw` component's `shapeUtils` prop to keep them in sync
2. Throttle snapshot saves at **500 ms** (matches tldraw docs' recommended default)
3. Use `useLayoutEffect` for the load-before-mount pattern so shapes appear on first paint
4. **Save document + session together** for a single-user desktop app (not partial) — session carries the camera, selection, and UI state, which users expect to survive restarts
5. Atomic write via `tmp + rename` to prevent corruption on crash
6. Keep the persistence IPC surface minimal: `loadSnapshot() → any`, `saveSnapshot(any) → void`

### 6. Asset handling (dropped files)

When users drag files from the OS onto the canvas, tldraw's default is to treat images/videos as image shapes. We override this to route known text file types to our `FileShape` and everything else to native image/video:

```ts
// renderer/canvas/asset-handlers.ts
editor.registerExternalContentHandler('files', async ({ files, point }) => {
  const center = point ?? editor.getViewportPageBounds().center
  for (const [i, file] of files.entries()) {
    if (isTextLike(file)) {
      // Our FileShape for text/code/markdown
      editor.createShape({
        type: 'file',
        x: center.x + i * 40,
        y: center.y + i * 40,
        props: {
          filePath: (file as any).path,   // Electron File has .path
          kind: guessKind(file.name),     // 'note' | 'code'
        },
      })
    } else {
      // Fall through to default image/video handler
      await editor.putExternalContent({ type: 'files', files: [file], point: center })
    }
  }
})
```

### 7. Schema migrations (for shape props changes over time)

When we ship a change to any custom shape's props we add a migration. Template:

```ts
// renderer/shapes/AgentShape/migrations.ts
import { createShapePropsMigrationIds, createShapePropsMigrationSequence } from 'tldraw'

const versions = createShapePropsMigrationIds('agent', {
  AddModel: 1,         // v1 added `model` prop
  RenameProvider: 2,   // v2 renamed 'claude' to 'claudeAgent'
})

export const agentShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: versions.AddModel,
      up(props) { props.model ??= 'claude-sonnet-4-6' },
    },
    {
      id: versions.RenameProvider,
      up(props) {
        if (props.provider === 'claude') props.provider = 'claudeAgent'
      },
    },
  ],
})
```

Attach via `static override migrations = agentShapeMigrations` on the shape util. **Every props change after first release must add a migration** — no exceptions. This is how we keep older snapshots loadable.

---

## Repo structure (for the new t3-canvas)

```
t3-canvas/
├── package.json                         # bun workspaces
├── bun.lock
├── README.md
├── PLAN.md                              # this file (moves from fork/PLAN.md)
├── tsconfig.json
├── electron-vite.config.ts              # electron-vite for hot reload
├── electron/                            # main process
│   ├── index.ts                         # bootstrap: window, menu, ipc
│   ├── ipc.ts                           # typed IPC surface
│   ├── persistence.ts                   # load/save snapshot
│   ├── t3-client.ts                     # T3 Code WebSocket client
│   ├── workspace.ts                     # multi-workspace state
│   ├── file-tree.ts                     # chokidar + fs walking
│   └── pty-host.ts                      # node-pty server (for terminal shape)
├── preload/
│   └── index.ts                         # contextBridge.exposeInMainWorld('t3canvas', ...)
├── renderer/                            # React SPA
│   ├── main.tsx                         # entry
│   ├── App.tsx                          # layout: Sidebar + Canvas
│   ├── canvas/
│   │   ├── Canvas.tsx                   # <Tldraw store={store} ... />
│   │   ├── useTldrawStore.ts            # persistence hook
│   │   ├── shape-registry.ts            # customShapeUtils + customTools arrays
│   │   ├── ui-overrides.tsx             # Toolbar, menus, kbd shortcuts
│   │   └── asset-handlers.ts            # file drop routing
│   ├── shapes/
│   │   ├── AgentShape/
│   │   │   ├── AgentShapeUtil.tsx
│   │   │   ├── AgentShapeTool.ts
│   │   │   ├── NewAgentDialog.tsx
│   │   │   ├── types.ts
│   │   │   └── migrations.ts
│   │   ├── FileShape/
│   │   │   ├── FileShapeUtil.tsx
│   │   │   ├── FileShapeTool.ts
│   │   │   ├── MarkdownEditor.tsx       # BlockNote wrapper
│   │   │   ├── CodeEditor.tsx           # Monaco wrapper
│   │   │   ├── ImageView.tsx
│   │   │   ├── types.ts
│   │   │   └── migrations.ts
│   │   └── TerminalShape/
│   │       ├── TerminalShapeUtil.tsx
│   │       ├── TerminalShapeTool.ts
│   │       ├── Terminal.tsx             # xterm.js component
│   │       ├── types.ts
│   │       └── migrations.ts
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── FileTree.tsx
│   │   └── WorkspaceSwitcher.tsx
│   ├── settings/
│   │   ├── SettingsPanel.tsx
│   │   └── T3CodeSection.tsx
│   ├── lib/
│   │   ├── t3-client-hook.ts            # React hook over IPC to electron/t3-client.ts
│   │   └── ipc.ts                       # typed wrappers over window.t3canvas
│   └── types/
│       └── global.d.ts                  # declare module 'tldraw' augmentations, window.t3canvas
└── fork/                                # holds this PLAN.md during transition, deleted after move
```

---

## Phases

### Phase 0 — Spike (2 hours, ~200 LOC)

**Goal:** validate the three critical assumptions before committing to the full rebuild.

**Build:**
1. `electron-vite` scaffold with Electron + Vite + React + TypeScript
2. One window with `<Tldraw>` full-screen
3. Custom `AgentShape` with an `<iframe>` pointed at a public test URL (e.g. `https://example.com`)
4. Hard-code two native `frame` shapes on mount with the agent shape as a child of each
5. Persistence wired through Electron IPC → `~/.t3-canvas-spike/state.json`
6. Atomic read/write via `fs/promises`

**Acceptance:**
- ✅ iframe is interactive — clicks, form fields, scrolling work inside the shape
- ✅ frames visibly contain their children; moving a frame moves the shapes inside it
- ✅ state round-trips through disk — close and reopen, the shapes + camera are back
- ✅ pan/zoom works smoothly
- ✅ shapes stay snapped to the grid when dragged

**If any fail:** stop and reconsider. Either fall back to forking Collaborator, or identify the specific tldraw patch needed. Do NOT start Phase 1 until all four pass.

**If all pass:** commit the spike as tag `v0.0.0-spike` and proceed.

### Phase 1 — Skeleton (~400 LOC, 1-2 days)

**Goal:** app shell with the basics in place. No agent/file logic yet, just infrastructure.

**Acceptance test:** app launches, canvas renders, you can draw tldraw's native shapes, state persists across restart, there's a sidebar placeholder.

**Work:**
1. `electron/index.ts` — Electron bootstrap, window, application menu (~100 LOC)
2. `electron/ipc.ts` — typed IPC surface with `contextBridge.exposeInMainWorld('t3canvas', {...})` (~50 LOC)
3. `electron/persistence.ts` — atomic snapshot save/load (~60 LOC)
4. `preload/index.ts` — contextBridge setup (~30 LOC)
5. `renderer/main.tsx` + `App.tsx` — root layout with sidebar + canvas columns (~80 LOC)
6. `renderer/canvas/Canvas.tsx` — `<Tldraw>` mounted with our custom store (~40 LOC)
7. `renderer/canvas/useTldrawStore.ts` — persistence hook with throttled save (~50 LOC)
8. `renderer/canvas/shape-registry.ts` — empty `customShapeUtils`/`customTools` arrays, ready for Phase 2+ (~20 LOC)
9. `renderer/canvas/ui-overrides.tsx` — empty `uiOverrides`/`components` stubs (~30 LOC)
10. `electron-vite.config.ts` + `tsconfig.json` + `package.json` with deps (~100 LOC)

**Dependencies to add:**
- `electron`, `electron-vite`, `electron-builder`
- `react`, `react-dom`
- `tldraw` + `tldraw/tldraw.css`
- `lodash-es` (for throttle)
- dev: `typescript`, `vite`, `@types/*`

### Phase 2 — Agent Shape MVP (~350 LOC + T3 Code patch, 2-3 days)

**Goal:** can create an agent tile that embeds a live T3 Code thread.

**Acceptance test:**
1. Start T3 Code separately: `cd ~/Documents/Github/personal/t3code && bun run dev`
2. Start t3-canvas: `bun run dev`
3. In t3-canvas, press `g` or click "Agent" in toolbar → click canvas → dialog asks for cwd/provider/model
4. Agent tile appears, embedded iframe shows a live T3 Code thread
5. Type a turn, see streaming response inside the tile
6. Close/reopen t3-canvas → tile reconnects to the same thread

**T3 Code side work (separate repo: `feat/embed-thread-route` branch on your t3code fork):**
- `apps/web/src/routes/EmbedThread.tsx` (new) — minimal standalone page, no sidebar chrome, reads `threadId` from URL param
- `apps/web/src/App.tsx` — add `/embed/thread/:id` route
- `apps/web/src/components/EmbedThreadView.tsx` (new) — wraps the existing conversation component
- CSS: when `?minimal=1` is set, hide the app's own header/footer
- Verify: server exposes `createThread(cwd, provider, model)` over WebSocket (or add a shim)

Est ~200 LOC in t3code.

**t3-canvas side work:**
1. `electron/t3-client.ts` — WebSocket client: `createThread`, `listThreads`, `getThread` (~150 LOC)
2. `electron/ipc.ts` — expose t3-client over IPC (~30 LOC)
3. `renderer/lib/t3-client-hook.ts` — React hook wrapping the IPC surface (~50 LOC)
4. `renderer/shapes/AgentShape/AgentShapeUtil.tsx` — the shape util following the pattern above (~100 LOC)
5. `renderer/shapes/AgentShape/AgentShapeTool.ts` — click-to-create tool (~40 LOC)
6. `renderer/shapes/AgentShape/NewAgentDialog.tsx` — modal asking for cwd/provider/model (~120 LOC)
7. `renderer/shapes/AgentShape/types.ts`, `migrations.ts` (~40 LOC)
8. `renderer/canvas/shape-registry.ts` — register `AgentShapeUtil`, `AgentTool` (~5 LOC)
9. `renderer/canvas/ui-overrides.tsx` — add "Agent" to toolbar (~20 LOC)

Est ~555 LOC total for Phase 2.

**Non-goals for Phase 2:**
- ❌ File shapes
- ❌ Terminal shapes
- ❌ Frames as a user feature (they exist since they're native in tldraw, just no UX around them yet)
- ❌ Multi-workspace (hardcoded workspace path is fine)
- ❌ Settings UI (hardcoded T3 Code URL is fine)

### Phase 3 — File Shapes (~600 LOC, 3-4 days)

**Goal:** drag files from the sidebar or the OS onto the canvas; they render as Monaco/BlockNote/image tiles.

**Acceptance test:** drag a `.md` file from the sidebar → markdown tile with rich editing. Drag a `.py` file → Monaco with Python highlighting. Drag a `.png` → image preview. Edits to the markdown tile write to disk. External changes to the file on disk reload the tile.

**Work:**
1. `electron/file-tree.ts` — chokidar watching, `readTree` RPC (~80 LOC)
2. `renderer/sidebar/FileTree.tsx` — simple expand/collapse tree (~150 LOC)
3. `renderer/sidebar/Sidebar.tsx` — layout wrapper (~40 LOC)
4. `renderer/shapes/FileShape/FileShapeUtil.tsx` — picks editor by file kind (~120 LOC)
5. `renderer/shapes/FileShape/MarkdownEditor.tsx` — BlockNote wrapper (~100 LOC)
6. `renderer/shapes/FileShape/CodeEditor.tsx` — Monaco wrapper (~80 LOC)
7. `renderer/shapes/FileShape/ImageView.tsx` (~30 LOC)
8. `renderer/shapes/FileShape/FileShapeTool.ts` (~40 LOC)
9. `renderer/canvas/asset-handlers.ts` — file drop routing (~60 LOC)

Est ~700 LOC. Adds `@blocknote/react`, `monaco-editor`, `chokidar` as deps.

**Non-goals:** frontmatter, wiki-links, cover images (nice-to-haves, Phase 5).

### Phase 4 — Terminal Shape (~400 LOC, 2 days)

**Goal:** terminal tiles run a local PTY session, survive tile close (session persists in main process).

**Acceptance test:** create terminal tile, `ls`, close tile, reopen from a "terminals" list → same session with history intact.

**Work:**
1. `electron/pty-host.ts` — node-pty process manager, session persistence (~150 LOC)
2. `electron/ipc.ts` — add pty RPC: `spawnPty`, `writePty`, `resizePty`, `killPty`, data events (~50 LOC)
3. `renderer/shapes/TerminalShape/TerminalShapeUtil.tsx` (~80 LOC)
4. `renderer/shapes/TerminalShape/Terminal.tsx` — xterm.js, listens to pty data events (~120 LOC)

Adds `node-pty`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl`.

### Phase 5 — Polish (~400 LOC, 2-3 days)

- Multi-workspace switcher in sidebar (~80 LOC)
- Settings panel with T3 Code URL + defaults (~100 LOC)
- Custom keyboard shortcuts and application menu (~60 LOC)
- Frame creation UX: right-click → "Frame selection" (~40 LOC)
- Markdown frontmatter parsing + display (~80 LOC)
- Error states: T3 Code unreachable banner, thread-not-found tile state (~50 LOC)

### Phase 6 — Agent Tile Native Rendering (later, optional)

- Replace iframe with a direct React component that talks to T3 Code's WebSocket
- `packages/t3-client/` standalone package with React hooks and types
- Native conversation rendering, streaming, tool call display, approval UI
- ~800 LOC, dropped T3 Code embed route dependency

**Only pursue if the iframe approach from Phase 2 shows real limitations** (keyboard shortcut conflicts, performance at scale, etc.).

---

## Data model summary

### Shapes (all stored inside tldraw's store)

| Shape type | Props | Notes |
|---|---|---|
| `frame` | (native) `w, h, name, color` | Clustering/grouping |
| `agent` | `w, h, threadId, t3ServerUrl, provider, model?` | T3 Code thread iframe |
| `file` | `w, h, filePath, kind: 'note' \| 'code' \| 'image', editorState?` | Monaco/BlockNote/image |
| `terminal` | `w, h, ptySessionId, cwd, shell` | xterm + node-pty |

All other shapes (geo, arrow, text, draw, note, line, etc.) are tldraw defaults we get for free.

### App config

```jsonc
// ~/.t3-canvas/config.json
{
  "version": 1,
  "workspaces": ["/home/rohan/Documents/Github/personal/t3code"],
  "activeWorkspace": 0,
  "t3code": {
    "serverUrl": "http://localhost:8765",
    "defaultProvider": "claudeAgent",
    "defaultModel": "claude-sonnet-4-6"
  },
  "window": { "x": 100, "y": 100, "width": 1600, "height": 1000, "isMaximized": false }
}
```

### Canvas state

```jsonc
// ~/.t3-canvas/canvas-state.json
{
  "document": { /* tldraw document snapshot — shapes, pages, assets */ },
  "session": { /* camera, selection, UI state */ }
}
```

No separate "tiles" or "frames" array — everything is tldraw shapes.

---

## Open questions (revisit as we build)

| Question | Current proposal | Revisit at phase |
|---|---|---|
| How to handle T3 Code server being down? | Banner in sidebar + agent tiles show "disconnected" overlay | Phase 2 |
| Thread id becomes stale (T3 Code DB wiped) | Shape shows "thread not found", offers to recreate | Phase 2 |
| Multiple t3-canvas instances sharing one T3 Code? | Allowed but each tile has own threadId; no cross-canvas coord | Phase 2 |
| Monaco + BlockNote bundle size | Monaco alone is ~4 MB minified; fine for Electron, watch for memory | Phase 3 |
| File watcher restart on workspace change | chokidar close/reopen | Phase 3 |
| Terminal session cleanup on app quit | Kill on will-quit, persist optional | Phase 4 |
| Frame UX discoverability | Native tldraw frame tool is fine; maybe add "Frame selection" right-click | Phase 5 |
| PostHog telemetry from collab-public | N/A — we never added it to this rebuild | — |

---

## License

- `tldraw` — Apache-2.0
- `electron`, `electron-vite` — MIT
- `monaco-editor` — MIT
- `@blocknote/react` — MPL-2.0 (fine for our use)
- `node-pty`, `@xterm/xterm` — MIT
- `chokidar` — MIT
- Our own code — undecided, defer until we actually publish anything. **Personal/private use has no license obligations regardless.**

No FSL-1.1 constraint. No Collaborator code in the tree. Full commercial freedom if we ever want it.

---

## How to run (after Phase 0)

```bash
# Setup
cd ~/Documents/Github/personal/t3-canvas
source ~/.bashrc
sandbox-personal-bun bun install

# Dev mode (Electron + Vite hot reload)
export PATH="$HOME/.bun/bin:$PATH"
ELECTRON_DISABLE_SANDBOX=1 bun run dev

# With T3 Code running in another terminal:
cd ~/Documents/Github/personal/t3code && bun run dev
```

State stored in `~/.t3-canvas/`. Dev mode isolates under `~/.t3-canvas/dev/`.

---

## Meta

- Total estimated new code: ~2550 LOC across Phases 0–5
- Every shape follows the locked-in tldraw patterns above — no drift
- Every phase has explicit acceptance criteria
- Every phase has explicit non-goals
- When stuck, grep `~/Documents/Github/personal/collab-reference/` for patterns, but DO NOT copy code (license reasons + different paradigm)
- tldraw docs URL: https://tldraw.dev — keep a tab open during Phase 1

**Next action:** approve this plan, then execute Phase 0 (the spike). If the spike passes its four acceptance criteria, commit to the full rebuild. If not, fall back to the fork plan (still in git history as `b0b18e1`).
