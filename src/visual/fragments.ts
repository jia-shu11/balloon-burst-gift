import type { BalloonGift } from "../domain/types";

export type FragmentKind = "text" | "extraText" | "image" | "waveform" | "signature" | "particle";

export interface Fragment {
  id: string;
  giftId: string;
  kind: FragmentKind;
  content: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  size: number;
  audioUrl: string;
}

export interface Point {
  x: number;
  y: number;
}

function words(text: string) {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function direction(index: number, count: number, radius: number) {
  const angle = (Math.PI * 2 * index) / Math.max(1, count);
  return {
    vx: Math.cos(angle) * (80 + radius * 0.24),
    vy: Math.sin(angle) * (80 + radius * 0.24)
  };
}

function fragmentId(giftId: string, kind: FragmentKind, index: number) {
  return `${giftId}:${kind}:${index}`;
}

export function createBurstFragments(gift: BalloonGift, origin: Point, burstAll: boolean): Fragment[] {
  const transcriptPieces = words(gift.editedTranscript || gift.transcript);
  const extraPieces = words(gift.extraText);
  const base: Array<{ kind: FragmentKind; content: string }> = [
    ...transcriptPieces.map((content) => ({ kind: "text" as const, content })),
    ...extraPieces.map((content) => ({ kind: "extraText" as const, content })),
    ...gift.imageUrls.map((content) => ({ kind: "image" as const, content })),
    { kind: "waveform", content: gift.audioUrl },
    { kind: "signature", content: gift.giverName }
  ];

  const particleCount = Math.max(0, gift.balloonParams.fragmentCount - base.length);
  for (let index = 0; index < particleCount; index += 1) {
    base.push({ kind: "particle", content: "" });
  }

  return base.map((item, index) => {
    const vector = direction(index, base.length, gift.balloonParams.burstRadius);
    const speed = burstAll ? 1.28 : 1;
    return {
      id: fragmentId(gift.id, item.kind, index),
      giftId: gift.id,
      kind: item.kind,
      content: item.content,
      x: origin.x,
      y: origin.y,
      vx: vector.vx * speed,
      vy: vector.vy * speed,
      rotation: index * 17,
      size: item.kind === "image" ? 112 : item.kind === "signature" ? 28 : 18,
      audioUrl: gift.audioUrl
    };
  });
}

export function updateFragments(fragments: Fragment[], deltaSec: number, bounds: { width: number; height: number }) {
  return fragments.map((fragment) => {
    const nextX = fragment.x + fragment.vx * deltaSec;
    const nextY = fragment.y + fragment.vy * deltaSec;
    return {
      ...fragment,
      x: Math.min(bounds.width - 24, Math.max(24, nextX)),
      y: Math.min(bounds.height - 24, Math.max(24, nextY)),
      vx: fragment.vx * 0.988,
      vy: fragment.vy * 0.988
    };
  });
}
