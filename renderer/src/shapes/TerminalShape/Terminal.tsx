import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

/**
 * Xterm.js host for a single PTY session.
 *
 * Responsibilities:
 *   - Mount an xterm `Terminal` into a div, attach the `FitAddon` (for
 *     responsive sizing) and — best-effort — the `WebglAddon` for GPU
 *     acceleration. WebGL init sometimes fails in Electron on Linux (no
 *     GLX, headless launches, software rasterizer misdetection); we fall
 *     back to xterm's DOM/canvas renderer without a user-visible error.
 *   - Stream data from the main process into the xterm instance and user
 *     keystrokes back through `window.t3canvas.pty.write`.
 *   - Track container size with a `ResizeObserver` so the pty is kept in
 *     lockstep with the tile's pixel dimensions.
 *
 * Persistence note (Phase 4 stretch goal):
 *   We do NOT kill the pty on unmount — that's what makes a shape close/
 *   reopen cycle cheap. The main process owns the session lifetime; killing
 *   is the shape's explicit `pty:kill` call path (not wired in Phase 4).
 *
 * tldraw constraint note:
 *   The parent HTMLContainer already sets `pointerEvents: "all"`. We still
 *   stopPropagation on pointer / key / wheel events inside the xterm host
 *   so the canvas doesn't treat typing-over-terminal as a pan / marquee /
 *   text-edit gesture.
 */
export interface TerminalProps {
  readonly sessionId: string;
  /**
   * Called once xterm has measured itself via `fit()` so the parent shape
   * util can persist the current cols/rows back to the tldraw store.
   */
  readonly onResize?: (cols: number, rows: number) => void;
}

export function Terminal({ sessionId, onResize }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Create the terminal with a dark-themed default and the familiar
    // mono font stack. All of this could be lifted to user settings later.
    const term = new XTerm({
      cursorBlink: true,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', 'Roboto Mono', monospace",
      fontSize: 13,
      theme: {
        background: "#0f1117",
        foreground: "#e6e6e6",
        cursor: "#e6e6e6",
      },
      // We track rows/cols through FitAddon; these are just the boot size
      // before the first `fit()` call lands.
      cols: 80,
      rows: 24,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);

    // WebGL is strictly a perf optimization. Don't let it crash the tile
    // if init throws — xterm silently falls back to its DOM renderer.
    let webgl: WebglAddon | undefined;
    try {
      webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        // Context loss is fatal for the addon; drop it and keep running.
        webgl?.dispose();
      });
      term.loadAddon(webgl);
    } catch {
      // Leave `webgl` unset; nothing else to do.
    }

    // First fit, then tell the main-process pty about our actual size.
    try {
      fitAddon.fit();
    } catch {
      // Fit can throw if the container has zero dimensions (e.g. the shape
      // was created mid-drag). A ResizeObserver will retry on the next
      // layout tick.
    }

    // Stream PTY → xterm. The preload bridge fans every pty:data event to
    // every listener; filter by sessionId here.
    const unsubscribeData = window.t3canvas.pty.onData((id, data) => {
      if (id !== sessionId) return;
      term.write(data);
    });

    // Stream xterm → PTY. `onData` fires on keystrokes AND paste events.
    const inputDisposable = term.onData((input) => {
      void window.t3canvas.pty.write(sessionId, input);
    });

    // Debounce resize calls through a tiny timer so rapid drag-resizes
    // don't hammer the main process. node-pty resize is cheap but xterm's
    // fit() does layout math we don't need to repeat per pointer event.
    let resizeTimer: number | undefined;
    const scheduleFit = (): void => {
      if (resizeTimer !== undefined) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = undefined;
        try {
          fitAddon.fit();
        } catch {
          return;
        }
        const cols = term.cols;
        const rows = term.rows;
        void window.t3canvas.pty.resize(sessionId, cols, rows);
        onResize?.(cols, rows);
      }, 16);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });
    resizeObserver.observe(host);

    // A follow-up fit on the next frame catches the case where the tile
    // was created at its final size in the same tick as mount — the very
    // first `fit()` call above sometimes rounds to 80x24 before layout
    // has a chance to settle.
    const raf = window.requestAnimationFrame(() => scheduleFit());

    // Keep keyboard focus glued to the terminal when the tile is clicked
    // into. Otherwise the first keystroke goes to tldraw's own focus sink.
    term.focus();

    return () => {
      window.cancelAnimationFrame(raf);
      if (resizeTimer !== undefined) {
        window.clearTimeout(resizeTimer);
      }
      resizeObserver.disconnect();
      inputDisposable.dispose();
      unsubscribeData();
      try {
        webgl?.dispose();
      } catch {
        // ignore
      }
      term.dispose();
      // NOTE: intentionally NOT calling `window.t3canvas.pty.kill(sessionId)`.
      // The main process owns the session's lifetime so we can re-attach
      // on a future phase (and, in the meantime, so the shape survives a
      // tldraw re-render without losing scrollback).
    };
  }, [sessionId, onResize]);

  return (
    <div
      ref={hostRef}
      // Critical: every user interaction with the terminal must stay inside
      // the terminal. Without these stopPropagations tldraw will start a
      // pan/drag/select gesture on pointer down, swallow arrow keys, etc.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        backgroundColor: "#0f1117",
      }}
    />
  );
}
