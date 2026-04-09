import type { TLComponents, TLUiOverrides } from "tldraw";

/**
 * UI customization surface for the tldraw editor.
 *
 * Phase 1: both exports are empty stubs. Tldraw's default toolbar / menus /
 * keyboard shortcuts render unchanged.
 *
 * Phase 2+: add tool items for "Agent", "File", "Terminal", custom toolbar
 * buttons, keyboard shortcuts. See agent-template/client/components/ and the
 * patterns in fork/REFERENCES.md § tldraw patterns.
 */

export const uiOverrides: TLUiOverrides = {};

export const components: TLComponents = {};
