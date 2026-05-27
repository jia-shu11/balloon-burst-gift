import type { BalloonParams } from "../domain/types";

export type PathCommand =
  | { type: "moveTo"; x: number; y: number }
  | { type: "bezierCurveTo"; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
  | { type: "knot"; x: number; y: number; width: number; height: number }
  | { type: "string"; x: number; y: number; length: number; curve: number };

export function createBalloonPathCommands(params: BalloonParams, x: number, y: number, time: number): PathCommand[] {
  const r = params.radius;
  const wobble = Math.sin(time * 2 + params.hue) * params.wobble * 5;
  const left = x - r * params.stretchX + wobble;
  const right = x + r * params.stretchX - wobble;
  const top = y - r * params.stretchY;
  const bottom = y + r * params.stretchY;

  return [
    { type: "moveTo", x, y: top },
    {
      type: "bezierCurveTo",
      cp1x: right + r * 0.18,
      cp1y: top + r * 0.18,
      cp2x: right,
      cp2y: y + r * 0.62,
      x,
      y: bottom
    },
    {
      type: "bezierCurveTo",
      cp1x: left,
      cp1y: y + r * 0.62,
      cp2x: left - r * 0.14,
      cp2y: top + r * 0.16,
      x,
      y: top
    },
    { type: "knot", x, y: bottom + 6, width: r * 0.28, height: r * 0.18 },
    { type: "string", x, y: bottom + r * 0.18, length: params.stringLength, curve: Math.sin(time + params.hue) * 14 }
  ];
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
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 18 + params.glow * 34;
  ctx.shadowColor = `hsl(${params.hue} 95% 62%)`;

  ctx.beginPath();
  for (const command of commands) {
    if (command.type === "moveTo") ctx.moveTo(command.x, command.y);
    if (command.type === "bezierCurveTo") {
      ctx.bezierCurveTo(command.cp1x, command.cp1y, command.cp2x, command.cp2y, command.x, command.y);
    }
  }
  ctx.closePath();

  const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.5, radius * 0.08, x, y, radius * 1.35);
  gradient.addColorStop(0, `hsla(${params.hue} 100% 92% / 0.95)`);
  gradient.addColorStop(0.18, `hsla(${params.hue} 96% 66% / 0.88)`);
  gradient.addColorStop(0.72, `hsla(${(params.hue + 36) % 360} 86% 48% / 0.68)`);
  gradient.addColorStop(1, `hsla(${params.hue} 92% 20% / 0.56)`);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.lineWidth = 1.4;
  ctx.strokeStyle = `hsla(${params.hue} 100% 88% / 0.5)`;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  for (let index = 0; index < params.surfaceWaveDensity; index += 1) {
    const offset = (index / params.surfaceWaveDensity - 0.5) * radius * 1.3;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y + offset,
      radius * (0.18 + index * 0.016),
      radius * 0.05,
      Math.sin(time + index) * 0.4,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  const knot = commands.find((command): command is Extract<PathCommand, { type: "knot" }> => command.type === "knot");
  if (knot) {
    ctx.fillStyle = `hsla(${params.hue} 88% 58% / 0.9)`;
    ctx.beginPath();
    ctx.ellipse(knot.x, knot.y, knot.width / 2, knot.height / 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const string = commands.find(
    (command): command is Extract<PathCommand, { type: "string" }> => command.type === "string"
  );
  if (string) {
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
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
