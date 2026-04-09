import { BaseBoxShapeUtil, HTMLContainer, type RecordProps, T, type TLShape } from "tldraw";

const AGENT_SHAPE_TYPE = "agent" as const;

declare module "tldraw" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface TLGlobalShapePropsMap {
    [AGENT_SHAPE_TYPE]: {
      w: number;
      h: number;
      url: string;
    };
  }
}

export type IAgentShape = TLShape<typeof AGENT_SHAPE_TYPE>;

export class AgentShapeUtil extends BaseBoxShapeUtil<IAgentShape> {
  static override type = AGENT_SHAPE_TYPE;

  static override props: RecordProps<IAgentShape> = {
    w: T.number,
    h: T.number,
    url: T.string,
  };

  override getDefaultProps(): IAgentShape["props"] {
    return {
      w: 560,
      h: 380,
      url: "https://example.com",
    };
  }

  override canEdit(): boolean {
    return false;
  }

  override canResize(): boolean {
    return true;
  }

  override isAspectRatioLocked(): boolean {
    return false;
  }

  component(shape: IAgentShape) {
    // Allow two addressing modes in the same prop:
    //   - regular URL → iframe src
    //   - "srcdoc:<html>" → iframe srcdoc (inline HTML, no network, no CSP concerns)
    const isSrcdoc = shape.props.url.startsWith("srcdoc:");
    const iframeProps = isSrcdoc
      ? { srcDoc: shape.props.url.slice("srcdoc:".length) }
      : { src: shape.props.url };
    const headerLabel = isSrcdoc ? "🤖 inline srcdoc" : `🤖 ${shape.props.url}`;

    return (
      <HTMLContainer
        style={{
          pointerEvents: "all",
          overflow: "hidden",
          border: "1px solid #888",
          borderRadius: 8,
          backgroundColor: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            backgroundColor: "#f5f5f5",
            borderBottom: "1px solid #ddd",
            fontSize: 12,
            color: "#666",
            fontFamily: "system-ui, sans-serif",
            flex: "0 0 auto",
            userSelect: "none",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {headerLabel}
        </div>
        <iframe
          title={`agent-${shape.id}`}
          {...iframeProps}
          style={{
            flex: "1 1 auto",
            width: "100%",
            border: "none",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        />
      </HTMLContainer>
    );
  }

  indicator(shape: IAgentShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
