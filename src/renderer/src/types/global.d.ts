import type { T3CanvasApi } from "../../../preload";

declare global {
  interface Window {
    t3canvas: T3CanvasApi;
  }
}

export {};
