# t3-canvas

A canvas-first workbench for AI coding agents. Infinite pan-zoom canvas where agent sessions, files, and terminals live as first-class tiles. Agents cluster into frames ("the migration team", "the research squad"). Built with tldraw + Electron.

**Status:** Pre-spike. See [PLAN.md](./PLAN.md) for the full implementation plan and [issues](../../issues) for what's in flight.

**Integrates with** a locally-running [t3code](https://github.com/rororowyourboat/t3code) server (MIT fork of pingdotgg/t3code).

## Quick links

- **[PLAN.md](./PLAN.md)** — architecture, phase breakdown, tldraw patterns we follow
- **[Issues](../../issues)** — tracked work, one issue per phase or sub-task
- **Worktree workflow** — see the "Parallel worktrees" section below

## Parallel worktrees

Each issue has a corresponding branch. To work on multiple issues in parallel without repeatedly switching branches in a single clone:

```bash
# First time: from inside ~/Documents/Github/personal/t3-canvas
git worktree add ../t3-canvas-spike feat/phase-0-spike
git worktree add ../t3-canvas-skeleton feat/phase-1-skeleton
git worktree add ../t3-canvas-agent feat/phase-2-agent-shape

# Each worktree is a full checkout at a different branch
cd ../t3-canvas-spike   # work on the spike
cd ../t3-canvas-agent   # work on the agent shape in parallel

# When done, merge via PR (or rebase + merge locally), then remove the worktree
git worktree remove ../t3-canvas-spike
```

Conventions:
- Branch names: `feat/phase-<N>-<slug>` or `feat/issue-<number>-<slug>`
- `main` only receives merged work; active development happens on feature branches via worktrees
- Each worktree gets its own `node_modules` — run `sandbox-personal-bun bun install` inside each after creating it

## Running

After Phase 1 skeleton ships:

```bash
cd ~/Documents/Github/personal/t3-canvas
source ~/.bashrc
sandbox-personal-bun bun install
export PATH="$HOME/.bun/bin:$PATH"
ELECTRON_DISABLE_SANDBOX=1 bun run dev
```

State stored in `~/.t3-canvas/`. Dev mode isolates under `~/.t3-canvas/dev/`.

## License

Undecided — personal use for now. Dependencies: tldraw (Apache-2.0), Electron (MIT), Monaco (MIT), node-pty (MIT), BlockNote (MPL-2.0).
