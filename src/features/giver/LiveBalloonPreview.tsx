import { type CSSProperties, useEffect, useId, useState } from "react";
import type { BalloonParams } from "../../domain/types";
import { createOrganicBalloonOutline, createSvgBalloonPath } from "../../visual/balloonOutline";

const PREVIEW_SAFE_WIDTH = 360;
const PREVIEW_SAFE_HEIGHT = 700;

export function getPreviewFitScale(width: number, height: number, stringLength: number) {
  const fullHeight = height + stringLength + 28;
  const scale = Math.min(1, PREVIEW_SAFE_WIDTH / Math.max(width, 1), PREVIEW_SAFE_HEIGHT / Math.max(fullHeight, 1));
  return Number(scale.toFixed(3));
}

function createVoiceLinePath(values: number[]) {
  const source = values.length ? values : [0];
  return source
    .map((value, index) => {
      const x = Number((-0.62 + (index / Math.max(1, source.length - 1)) * 1.24).toFixed(4));
      const y = Number((-value * 0.22).toFixed(4));
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function LiveBalloonPreview({ params, level }: { params: BalloonParams; level: number }) {
  const [poked, setPoked] = useState(false);
  const gradientId = `balloon-gradient-${useId().replace(/:/g, "")}`;
  const width = params.radius * 2 * params.stretchX;
  const height = params.radius * 2 * params.stretchY;
  const lightness = `${params.lightness}%`;
  const glow = 18 + params.glow * 42 + level * 20;
  const fitScale = getPreviewFitScale(width, height, params.stringLength);
  const bodyPath = createSvgBalloonPath(createOrganicBalloonOutline(params.spikeCount, params.spikeLength));

  useEffect(() => {
    if (!poked) return undefined;
    const timer = window.setTimeout(() => setPoked(false), 320);
    return () => window.clearTimeout(timer);
  }, [poked]);

  return (
    <div className={`live-balloon-wrap${poked ? " is-poked" : ""}`} aria-label="实时鼓胀气球预览">
      <div
        className="live-balloon-assembly"
        style={{
          transform: `scale(${fitScale})`,
          "--balloon-hue": params.hue
        } as CSSProperties}
      >
        <button
          type="button"
          className="live-balloon"
          aria-label="轻触气球预览"
          onClick={() => setPoked(true)}
          style={{
            width,
            height,
            boxShadow: "none",
            filter: `drop-shadow(0 0 ${glow}px hsl(${params.hue} 92% ${lightness} / 0.72))`,
            transform: `scale(${1 + level * 0.08}) rotate(${(params.stretchX - 1) * 8}deg)`,
            "--balloon-hue": params.hue,
            "--balloon-lightness": lightness
          } as CSSProperties}
        >
          <svg className="live-balloon-svg" viewBox="-1.08 -1.18 2.16 2.36" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <radialGradient id={gradientId} cx="30%" cy="20%" r="88%">
                <stop offset="0%" stopColor={`hsl(${params.hue} 92% 96%)`} stopOpacity="0.96" />
                <stop offset="24%" stopColor={`hsl(${params.hue} 88% ${Math.max(52, params.lightness)}%)`} stopOpacity="0.94" />
                <stop offset="78%" stopColor={`hsl(${(params.hue + 18) % 360} 72% ${Math.max(42, params.lightness - 10)}%)`} stopOpacity="0.84" />
                <stop offset="100%" stopColor={`hsl(${params.hue} 58% ${Math.max(36, params.lightness - 18)}%)`} stopOpacity="0.72" />
              </radialGradient>
            </defs>
            <path className="live-balloon-body" d={bodyPath} fill={`url(#${gradientId})`} />
            <g className="live-balloon-signature">
              <path className="live-balloon-voice-line" d={createVoiceLinePath(params.voiceSignature.waveformContour)} />
            </g>
            <ellipse className="live-balloon-highlight-shape" cx="-0.38" cy="-0.54" rx="0.18" ry="0.34" transform="rotate(18 -0.38 -0.54)" />
          </svg>
          <span className="live-balloon-neck" />
        </button>
        <div className="live-balloon-knot" />
        <div className="live-balloon-string" style={{ height: params.stringLength }} />
      </div>
    </div>
  );
}
