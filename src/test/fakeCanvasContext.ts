import { vi } from "vitest";

export function createFakeCanvasContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fill: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    quadraticCurveTo: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}
