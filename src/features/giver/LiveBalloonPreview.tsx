import { useEffect, useMemo, useState } from "react";
import type { BalloonParams } from "../../domain/types";
import { BalloonScene } from "../../visual/three/BalloonScene";

const PREVIEW_SAFE_WIDTH = 360;
const PREVIEW_SAFE_HEIGHT = 700;

export function getPreviewFitScale(width: number, height: number, stringLength: number) {
  const fullHeight = height + stringLength + 28;
  const scale = Math.min(1, PREVIEW_SAFE_WIDTH / Math.max(width, 1), PREVIEW_SAFE_HEIGHT / Math.max(fullHeight, 1));
  return Number(scale.toFixed(3));
}

export function LiveBalloonPreview({ params, level }: { params: BalloonParams; level: number }) {
  const [poked, setPoked] = useState(false);
  const [sceneMode, setSceneMode] = useState<"loading" | "ready" | "fallback">("loading");
  const balloons = useMemo(() => [{ id: "preview", params }], [params]);

  useEffect(() => {
    if (!poked) return undefined;
    const timer = window.setTimeout(() => setPoked(false), 320);
    return () => window.clearTimeout(timer);
  }, [poked]);

  return (
    <div
      className={`live-balloon-wrap live-balloon-3d${poked ? " is-poked" : ""}`}
      aria-label="实时鼓胀气球预览"
      data-scene-mode={sceneMode}
    >
      <BalloonScene
        variant="preview"
        className="live-balloon-3d-scene"
        balloons={balloons}
        level={poked ? Math.min(1, level + 0.45) : level}
        onBalloonClick={() => setPoked(true)}
        onStatus={setSceneMode}
      />
      <button type="button" className="sr-only" aria-label="轻触气球预览" onClick={() => setPoked(true)} />
    </div>
  );
}
