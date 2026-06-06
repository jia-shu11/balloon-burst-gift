export type BalloonOutlinePoint =
  | { kind: "surface"; x: number; y: number }
  | { kind: "spike-tip"; x: number; y: number; baseX: number; baseY: number };

export interface SmoothCurveSegment {
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
}

export interface SmoothClosedCurve {
  start: { x: number; y: number };
  segments: SmoothCurveSegment[];
}

const DEFAULT_SAMPLE_COUNT = 96;
const SPIKE_NECK_LIMIT = 0.72;

function cubicPoint(
  start: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  end: { x: number; y: number },
  t: number
) {
  const inverse = 1 - t;
  const inverseSquared = inverse * inverse;
  const tSquared = t * t;

  return {
    x:
      inverseSquared * inverse * start.x +
      3 * inverseSquared * t * cp1.x +
      3 * inverse * tSquared * cp2.x +
      tSquared * t * end.x,
    y:
      inverseSquared * inverse * start.y +
      3 * inverseSquared * t * cp1.y +
      3 * inverse * tSquared * cp2.y +
      tSquared * t * end.y
  };
}

function createBaseContour(sampleCount: number) {
  const count = Math.max(24, Math.round(sampleCount / 2) * 2);
  const half = count / 2;
  const top = { x: 0, y: -1 };
  const bottom = { x: 0, y: 1 };
  const rightCp1 = { x: 1.18, y: -0.82 };
  const rightCp2 = { x: 1, y: 0.62 };
  const leftCp1 = { x: -1, y: 0.62 };
  const leftCp2 = { x: -1.14, y: -0.84 };

  return [
    ...Array.from({ length: half }, (_, index) =>
      cubicPoint(top, rightCp1, rightCp2, bottom, index / half)
    ),
    ...Array.from({ length: half }, (_, index) =>
      cubicPoint(bottom, leftCp1, leftCp2, top, index / half)
    )
  ];
}

function selectSpikeIndices(points: { x: number; y: number }[], spikeCount: number) {
  const candidates = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.y < SPIKE_NECK_LIMIT);
  const count = Math.min(Math.max(0, Math.round(spikeCount)), candidates.length);

  return new Set(
    Array.from({ length: count }, (_, spikeIndex) => {
      const candidateIndex = Math.min(
        candidates.length - 1,
        Math.floor(((spikeIndex + 0.5) * candidates.length) / Math.max(1, count))
      );
      return candidates[candidateIndex].index;
    })
  );
}

export function createOrganicBalloonOutline(
  spikeCount: number,
  spikeLength: number,
  sampleCount = DEFAULT_SAMPLE_COUNT
): BalloonOutlinePoint[] {
  const base = createBaseContour(sampleCount);
  const spikeIndices = selectSpikeIndices(base, spikeCount);
  const extension = Math.max(0, spikeLength);

  return base.map((point, index) => {
    if (!spikeIndices.has(index) || extension === 0) {
      return { kind: "surface", x: point.x, y: point.y };
    }

    const previous = base[(index - 1 + base.length) % base.length];
    const next = base[(index + 1) % base.length];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const normalLength = Math.max(0.0001, Math.hypot(tangentY, -tangentX));
    const normalX = tangentY / normalLength;
    const normalY = -tangentX / normalLength;

    return {
      kind: "spike-tip",
      x: point.x + normalX * extension,
      y: point.y + normalY * extension,
      baseX: point.x,
      baseY: point.y
    };
  });
}

export function createSmoothClosedCurve(points: BalloonOutlinePoint[]): SmoothClosedCurve {
  if (points.length === 0) {
    return { start: { x: 0, y: 0 }, segments: [] };
  }

  const segments = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const afterNext = points[(index + 2) % points.length];
    const tension = 0.68;

    return {
      cp1x: point.kind === "spike-tip" ? point.x : point.x + ((next.x - previous.x) * tension) / 6,
      cp1y: point.kind === "spike-tip" ? point.y : point.y + ((next.y - previous.y) * tension) / 6,
      cp2x: next.kind === "spike-tip" ? next.x : next.x - ((afterNext.x - point.x) * tension) / 6,
      cp2y: next.kind === "spike-tip" ? next.y : next.y - ((afterNext.y - point.y) * tension) / 6,
      x: next.x,
      y: next.y
    };
  });

  return {
    start: { x: points[0].x, y: points[0].y },
    segments
  };
}

function format(value: number) {
  return Number(value.toFixed(4));
}

export function createSvgBalloonPath(points: BalloonOutlinePoint[]) {
  const curve = createSmoothClosedCurve(points);
  if (curve.segments.length === 0) return "";

  return [
    `M ${format(curve.start.x)} ${format(curve.start.y)}`,
    ...curve.segments.map(
      (segment) =>
        `C ${format(segment.cp1x)} ${format(segment.cp1y)} ${format(segment.cp2x)} ${format(segment.cp2y)} ${format(segment.x)} ${format(segment.y)}`
    ),
    "Z"
  ].join(" ");
}
