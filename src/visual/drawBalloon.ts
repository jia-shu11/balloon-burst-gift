import type { BalloonParams } from "../domain/types";
import { createOrganicBalloonOutline, createSmoothClosedCurve } from "./balloonOutline";

export type PathCommand =
  | { type: "moveTo"; x: number; y: number }
  | { type: "bezierCurveTo"; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
  | { type: "knot"; x: number; y: number; width: number; height: number }
  | { type: "string"; x: number; y: number; length: number; curve: number };

export function createBalloonPathCommands(params: BalloonParams, x: number, y: number, time: number): PathCommand[] {
  const r = params.radius;
  const wobble = Math.sin(time * 2 + params.hue) * params.wobble * 5;
  const bottom = y + r * params.stretchY;
  const curve = createSmoothClosedCurve(createOrganicBalloonOutline(params.spikeCount, params.spikeLength));
  const horizontalScale = r * params.stretchX - wobble;
  const verticalScale = r * params.stretchY;
  const transform = (point: { x: number; y: number }) => ({
    x: x + point.x * horizontalScale,
    y: y + point.y * verticalScale
  });
  const start = transform(curve.start);

  return [
    { type: "moveTo", x: start.x, y: start.y },
    ...curve.segments.map((segment) => {
      const cp1 = transform({ x: segment.cp1x, y: segment.cp1y });
      const cp2 = transform({ x: segment.cp2x, y: segment.cp2y });
      const end = transform(segment);
      return {
        type: "bezierCurveTo" as const,
        cp1x: cp1.x,
        cp1y: cp1.y,
        cp2x: cp2.x,
        cp2y: cp2.y,
        x: end.x,
        y: end.y
      };
    }),
    { type: "knot", x, y: bottom + 6, width: r * 0.28, height: r * 0.18 },
    { type: "string", x, y: bottom + r * 0.18, length: params.stringLength, curve: Math.sin(time + params.hue) * 14 }
  ];
}

export function createVoiceLinePoints(params: BalloonParams, x: number, y: number) {
  const contour = params.voiceSignature.waveformContour.length ? params.voiceSignature.waveformContour : [0, 0];
  const width = params.radius * params.stretchX * 1.18;
  const amplitude = params.radius * params.stretchY * 0.18;

  return contour.map((value, index) => ({
    x: x - width / 2 + (width * index) / Math.max(1, contour.length - 1),
    y: y - value * amplitude
  }));
}

export function drawBalloon(
  ctx: CanvasRenderingContext2D,
  params: BalloonParams,
  x: number,
  y: number,
  time: number,
  alpha = 1
) {
  const commands = createBalloonPathCommands(params, x, y, time);
  const radius = params.radius;
  const lightness = params.lightness ?? 66;
  const bodyLightness = Math.max(54, lightness);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 5 + params.glow * 9;
  ctx.shadowColor = `hsla(${params.hue} 82% 68% / 0.22)`;

  ctx.beginPath();
  for (const command of commands) {
    if (command.type === "moveTo") ctx.moveTo(command.x, command.y);
    if (command.type === "bezierCurveTo") {
      ctx.bezierCurveTo(command.cp1x, command.cp1y, command.cp2x, command.cp2y, command.x, command.y);
    }
  }
  ctx.closePath();

  const gradient = ctx.createRadialGradient(x - radius * 0.36, y - radius * 0.52, radius * 0.08, x, y, radius * 1.25);
  gradient.addColorStop(0, `hsla(${params.hue} 92% 96% / 0.94)`);
  gradient.addColorStop(0.18, `hsla(${params.hue} 88% ${bodyLightness}% / 0.9)`);
  gradient.addColorStop(0.74, `hsla(${(params.hue + 18) % 360} 74% ${Math.max(48, bodyLightness - 8)}% / 0.82)`);
  gradient.addColorStop(1, `hsla(${params.hue} 62% ${Math.max(42, bodyLightness - 14)}% / 0.62)`);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.lineWidth = 2.2;
  ctx.strokeStyle = `hsla(${params.hue} 42% 34% / 0.46)`;
  ctx.stroke();

  ctx.shadowBlur = 0;
  const voiceLinePoints = createVoiceLinePoints(params, x, y);
  if (voiceLinePoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(voiceLinePoints[0].x, voiceLinePoints[0].y);
    for (const point of voiceLinePoints.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.68)";
    ctx.stroke();
  }

  const knot = commands.find((command): command is Extract<PathCommand, { type: "knot" }> => command.type === "knot");
  if (knot) {
    ctx.fillStyle = `hsla(${params.hue} 72% 62% / 0.9)`;
    ctx.beginPath();
    ctx.ellipse(knot.x, knot.y, knot.width / 2, knot.height / 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `hsla(${params.hue} 42% 34% / 0.36)`;
    ctx.stroke();
  }

  const string = commands.find(
    (command): command is Extract<PathCommand, { type: "string" }> => command.type === "string"
  );
  if (string) {
    ctx.strokeStyle = "rgba(63, 50, 40, 0.36)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(string.x, string.y);
    ctx.quadraticCurveTo(
      string.x + string.curve,
      string.y + string.length * 0.5,
      string.x - string.curve * 0.2,
      string.y + string.length
    );
    ctx.stroke();
  }

  ctx.restore();
}
