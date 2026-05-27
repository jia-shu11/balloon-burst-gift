import { RefObject, useEffect } from "react";
import type { LaidOutBalloon } from "../../visual/balloonLayout";
import { drawBalloon } from "../../visual/drawBalloon";

export interface HitTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export function hitTestBalloon(targets: HitTarget[], point: { x: number; y: number }) {
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (Math.hypot(point.x - target.x, point.y - target.y) <= target.radius) {
      return target.id;
    }
  }
  return null;
}

function getContext(canvas: HTMLCanvasElement) {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

export function useCanvasBalloons(
  canvasRef: RefObject<HTMLCanvasElement>,
  layout: LaidOutBalloon[],
  burstIds: Set<string>
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas ? getContext(canvas) : null;
    if (!canvas || !ctx) return;

    const activeCanvas = canvas;
    const activeCtx = ctx;
    let frame = 0;
    let animationId = 0;

    function render() {
      const width = activeCanvas.clientWidth || 1200;
      const height = activeCanvas.clientHeight || 720;
      const ratio = window.devicePixelRatio || 1;
      activeCanvas.width = width * ratio;
      activeCanvas.height = height * ratio;
      activeCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
      activeCtx.clearRect(0, 0, width, height);

      for (const item of layout) {
        if (burstIds.has(item.gift.id)) continue;
        const driftY = Math.sin(frame / 60 + item.driftPhase) * 10;
        drawBalloon(activeCtx, item.gift.balloonParams, item.x, item.y + driftY, frame / 60);
      }

      frame += 1;
      animationId = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animationId);
  }, [burstIds, canvasRef, layout]);
}
