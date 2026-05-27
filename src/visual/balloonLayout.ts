import type { BalloonGift } from "../domain/types";

export interface StageSize {
  width: number;
  height: number;
}

export interface LaidOutBalloon {
  gift: BalloonGift;
  x: number;
  y: number;
  driftPhase: number;
}

function hash(value: string) {
  let result = 0;
  for (const char of value) {
    result = Math.imul(31, result) + char.charCodeAt(0);
  }
  return Math.abs(result);
}

function unit(id: string, salt: number) {
  return (Math.sin(hash(id) + salt * 371) + 1) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createBalloonLayout(gifts: BalloonGift[], stage: StageSize): LaidOutBalloon[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(gifts.length)));
  const rows = Math.max(1, Math.ceil(gifts.length / columns));
  const cellWidth = stage.width / columns;
  const cellHeight = stage.height / rows;

  return gifts.map((gift, index) => {
    const radius = gift.balloonParams.radius;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const rawX = column * cellWidth + cellWidth * (0.32 + unit(gift.id, 1) * 0.36);
    const rawY = row * cellHeight + cellHeight * (0.3 + unit(gift.id, 2) * 0.4);

    return {
      gift,
      x: Math.round(clamp(rawX, radius, stage.width - radius)),
      y: Math.round(clamp(rawY, radius, stage.height - radius)),
      driftPhase: Number((unit(gift.id, 3) * Math.PI * 2).toFixed(3))
    };
  });
}
