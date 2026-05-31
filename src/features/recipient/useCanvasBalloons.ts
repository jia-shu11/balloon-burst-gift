import { RefObject, useEffect } from "react";
import type { LaidOutBalloon } from "../../visual/balloonLayout";
import { drawBalloon } from "../../visual/drawBalloon";

const BASE_STAGE_WIDTH = 1200;
const BASE_STAGE_HEIGHT = 720;

export interface CanvasStageSize {
  width: number;
  height: number;
}

export const DEFAULT_CANVAS_STAGE_SIZE: CanvasStageSize = {
  width: BASE_STAGE_WIDTH,
  height: BASE_STAGE_HEIGHT
};

export function createResponsiveStageSize(visibleSize: { width: number; height: number }): CanvasStageSize {
  if (visibleSize.width <= 0 || visibleSize.height <= 0) return DEFAULT_CANVAS_STAGE_SIZE;

  return {
    width: BASE_STAGE_WIDTH,
    height: Math.round((BASE_STAGE_WIDTH * visibleSize.height) / visibleSize.width)
  };
}

export interface HitTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
  stretchX?: number;
  stretchY?: number;
}

export function hitTestBalloon(targets: HitTarget[], point: { x: number; y: number }) {
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    const radiusX = target.radius * (target.stretchX ?? 1);
    const radiusY = target.radius * (target.stretchY ?? 1);
    const normalizedDistance =
      (point.x - target.x) ** 2 / radiusX ** 2 + (point.y - target.y) ** 2 / radiusY ** 2;
    if (normalizedDistance <= 1) {
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
  burstIds: Set<string>,
  stageSize: CanvasStageSize = DEFAULT_CANVAS_STAGE_SIZE
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
      const ratio = window.devicePixelRatio || 1;
      activeCanvas.width = stageSize.width * ratio;
      activeCanvas.height = stageSize.height * ratio;
      activeCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
      activeCtx.clearRect(0, 0, stageSize.width, stageSize.height);

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
  }, [burstIds, canvasRef, layout, stageSize]);
}
