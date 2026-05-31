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
  angularVelocity: number;
  driftPhase: number;
  age: number;
  pulse: number;
  held?: boolean;
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
  const variation = Math.sin(index * 9.37) * 26;
  return {
    vx: Math.cos(angle) * (96 + radius * 0.28 + variation),
    vy: Math.sin(angle) * (96 + radius * 0.28 + variation)
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
    ...(burstAll ? [] : [{ kind: "waveform" as const, content: gift.audioUrl }]),
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
      angularVelocity: (index % 2 === 0 ? 1 : -1) * (28 + (index % 5) * 11),
      driftPhase: index * 0.83 + gift.balloonParams.hue * 0.01,
      age: 0,
      pulse: 0,
      size: item.kind === "image" ? 112 : item.kind === "signature" ? 28 : 18,
      audioUrl: gift.audioUrl
    };
  });
}

function bounce(value: number, velocity: number, min: number, max: number) {
  if (value < min) {
    return { value: min, velocity: Math.abs(velocity) * 0.72 };
  }
  if (value > max) {
    return { value: max, velocity: -Math.abs(velocity) * 0.72 };
  }
  return { value, velocity };
}

export function updateFragments(fragments: Fragment[], deltaSec: number, bounds: { width: number; height: number }) {
  return fragments.map((fragment) => {
    const nextAge = fragment.age + deltaSec;
    const nextPulse = Math.max(0, fragment.pulse - deltaSec * 1.8);
    if (fragment.held) {
      return {
        ...fragment,
        age: nextAge,
        pulse: nextPulse
      };
    }

    const drift = 18;
    const vx = fragment.vx * 0.992 + Math.cos(fragment.driftPhase + nextAge * 1.7) * drift * deltaSec;
    const vy = fragment.vy * 0.992 + Math.sin(fragment.driftPhase + nextAge * 1.35) * drift * deltaSec;
    const margin = fragment.kind === "image" ? 72 : 24;
    const bouncedX = bounce(fragment.x + vx * deltaSec, vx, margin, bounds.width - margin);
    const bouncedY = bounce(fragment.y + vy * deltaSec, vy, margin, bounds.height - margin);

    return {
      ...fragment,
      x: bouncedX.value,
      y: bouncedY.value,
      vx: bouncedX.velocity,
      vy: bouncedY.velocity,
      rotation: fragment.rotation + fragment.angularVelocity * deltaSec,
      angularVelocity: fragment.angularVelocity * 0.998,
      age: nextAge,
      pulse: nextPulse
    };
  });
}
