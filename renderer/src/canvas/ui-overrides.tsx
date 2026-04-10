import {
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  type TLComponents,
  type TLUiOverrides,
} from "tldraw";

/**
 * UI customization surface for the tldraw editor.
 *
 * Phase 2 added the "Agent" tool button (kbd `g`).
 * Phase 4 adds the "Terminal" tool button (kbd `t`).
 * Phase 3-lite's FileShape has no toolbar entry — file tiles are created
 * by drag-drop from the sidebar, not by a toolbar click.
 *
 * Pattern: declare each tool in `uiOverrides.tools` so it's registered with
 * the UI system, then customize `DefaultToolbar` via `components.Toolbar` to
 * render them alongside the default buttons. We ALWAYS keep tldraw's defaults
 * (select, arrow, text, etc.) visible — our custom entries are prepended.
 */

export const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools["agent"] = {
      id: "agent",
      icon: "tool-frame",
      label: "Agent",
      kbd: "g",
      onSelect: () => {
        editor.setCurrentTool("agent");
      },
    };
    tools["terminal"] = {
      id: "terminal",
      icon: "tool-note",
      label: "Terminal",
      kbd: "t",
      onSelect: () => {
        editor.setCurrentTool("terminal");
      },
    };
    return tools;
  },
};

export const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const agentTool = tools["agent"];
    const terminalTool = tools["terminal"];
    const isAgentSelected = useIsToolSelected(agentTool);
    const isTerminalSelected = useIsToolSelected(terminalTool);
    return (
      <DefaultToolbar {...props}>
        {agentTool && <TldrawUiMenuItem {...agentTool} isSelected={isAgentSelected} />}
        {terminalTool && (
          <TldrawUiMenuItem {...terminalTool} isSelected={isTerminalSelected} />
        )}
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
};
