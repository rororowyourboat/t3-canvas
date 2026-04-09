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
 * Phase 2 adds the "Agent" tool button to the toolbar with keyboard shortcut
 * `g`. Phase 3-lite's FileShape has no toolbar entry because file tiles are
 * created by drag-drop from the sidebar, not by a toolbar click.
 *
 * Pattern: declare the tool in `uiOverrides.tools` so it's registered with
 * the UI system, then customize `DefaultToolbar` via `components.Toolbar` to
 * render it alongside the default buttons. We ALWAYS keep tldraw's defaults
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
    return tools;
  },
};

export const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const agentTool = tools["agent"];
    const isAgentSelected = useIsToolSelected(agentTool);
    return (
      <DefaultToolbar {...props}>
        {agentTool && <TldrawUiMenuItem {...agentTool} isSelected={isAgentSelected} />}
        <DefaultToolbarContent />
      </DefaultToolbar>
    );
  },
};
