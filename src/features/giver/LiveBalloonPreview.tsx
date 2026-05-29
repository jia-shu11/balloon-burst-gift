import type { BalloonParams } from "../../domain/types";

const PREVIEW_SAFE_WIDTH = 360;
const PREVIEW_SAFE_HEIGHT = 700;

export function getPreviewFitScale(width: number, height: number, stringLength: number) {
  const fullHeight = height + stringLength + 28;
  const scale = Math.min(1, PREVIEW_SAFE_WIDTH / Math.max(width, 1), PREVIEW_SAFE_HEIGHT / Math.max(fullHeight, 1));
  return Number(scale.toFixed(3));
}

export function LiveBalloonPreview({ params, level }: { params: BalloonParams; level: number }) {
  const width = params.radius * 2 * params.stretchX;
  const height = params.radius * 2 * params.stretchY;
  const glow = 18 + params.glow * 42 + level * 20;
  const fitScale = getPreviewFitScale(width, height, params.stringLength);

  return (
    <div className="live-balloon-wrap" aria-label="实时鼓胀气球预览">
      <div
        className="live-balloon-assembly"
        style={{
          transform: `scale(${fitScale})`,
          ["--balloon-hue" as string]: params.hue
        }}
      >
        <div
          className="live-balloon"
          style={{
            width,
            height,
            borderRadius: "49% 51% 47% 53% / 43% 44% 56% 57%",
            filter: `drop-shadow(0 0 ${glow}px hsl(${params.hue} 92% 62% / 0.72))`,
            transform: `scale(${1 + level * 0.08}) rotate(${(params.stretchX - 1) * 8}deg)`
          }}
        >
          <div className="live-balloon-highlight" />
          <div className="live-balloon-neck" />
        </div>
        <div className="live-balloon-knot" />
        <div className="live-balloon-string" style={{ height: params.stringLength }} />
      </div>
    </div>
  );
}
