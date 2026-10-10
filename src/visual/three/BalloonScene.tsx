import { useEffect, useMemo, useRef, useState } from "react";
import { drawBalloon } from "../drawBalloon";
import { hitTestBalloon } from "../../features/recipient/useCanvasBalloons";
import { showcaseBalloons } from "./demoData";
import type { SceneBalloon, SceneQuality, SceneState, SceneVariant } from "./types";
import type { createBalloonScene } from "./createBalloonScene";
import "./scene.css";

const EMPTY_IDS = new Set<string>();
const DEFAULT_SIZE = { width: 1200, height: 720 };
type Runtime = ReturnType<typeof createBalloonScene>;

export interface BalloonSceneProps {
  variant?: SceneVariant;
  balloons?: SceneBalloon[];
  stageSize?: { width: number; height: number };
  excludedIds?: Set<string>;
  burstIds?: Set<string>;
  level?: number;
  className?: string;
  onBalloonClick?: (id: string, point: { x: number; y: number }) => void;
  onStatus?: (status: "ready" | "fallback") => void;
}

function fallbackItems(variant: SceneVariant, balloons: SceneBalloon[], size: { width: number; height: number }) {
  return balloons.map((item, index) => ({
    ...item,
    params: variant === "recipient" ? { ...item.params, radius: item.params.radius * Math.min(1.6, Math.max(1, size.height / size.width)) } : item.params,
    x: variant === "recipient" ? item.x ?? size.width / 2 : variant === "preview" ? size.width / 2 : size.width * (0.55 + index % 3 * 0.15),
    y: variant === "recipient" ? item.y ?? size.height / 2 : variant === "preview" ? size.height * 0.4 : size.height * (0.3 + Math.floor(index / 3) * 0.23)
  }));
}

export function BalloonScene({ variant = "hero", balloons = showcaseBalloons, stageSize = DEFAULT_SIZE, excludedIds = EMPTY_IDS, burstIds = EMPTY_IDS, level = 0, className = "", onBalloonClick, onStatus }: BalloonSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [quality, setQuality] = useState<SceneQuality>(() => window.innerWidth < 700 ? "balanced" : "high");
  const [paused, setPaused] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const callbacks = useRef({ onBalloonClick, onStatus });
  callbacks.current = { onBalloonClick, onStatus };
  const state = useMemo<SceneState>(() => ({ balloons, excludedIds, burstIds, stageSize, level, paused, quality }), [balloons, excludedIds, burstIds, stageSize, level, paused, quality]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let canceled = false;
    const canvas = canvasRef.current!;
    function fallback() {
      if (canceled) return;
      setStatus("fallback");
      callbacks.current.onStatus?.("fallback");
    }
    function lost(event: Event) {
      event.preventDefault();
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      fallback();
    }
    canvas.addEventListener("webglcontextlost", lost);
    if (typeof window.WebGL2RenderingContext === "undefined") {
      fallback();
    } else {
      void import("./createBalloonScene").then(({ createBalloonScene: create }) => {
        if (canceled) return;
        try {
          runtimeRef.current = create(canvas, variant, stateRef.current, (id, point) => callbacks.current.onBalloonClick?.(id, point));
          setStatus("ready");
          callbacks.current.onStatus?.("ready");
        } catch (error) {
          console.warn("3D scene unavailable; using the accessible fallback.", error);
          fallback();
        }
      }).catch(fallback);
    }
    return () => {
      canceled = true;
      canvas.removeEventListener("webglcontextlost", lost);
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [variant]);

  useEffect(() => { runtimeRef.current?.update(state); }, [state]);

  useEffect(() => {
    if (status !== "fallback" || typeof window.CanvasRenderingContext2D === "undefined") return;
    const canvas = canvasRef.current!;
    let context: CanvasRenderingContext2D | null = null;
    try { context = canvas.getContext("2d"); } catch { return; }
    if (!context) return;
    const ctx = context;
    let animation = 0;
    let time = 0;
    const items = fallbackItems(variant, balloons, stageSize);
    function render() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      if (canvas.width !== stageSize.width * ratio || canvas.height !== stageSize.height * ratio) {
        canvas.width = stageSize.width * ratio;
        canvas.height = stageSize.height * ratio;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, stageSize.width, stageSize.height);
      for (const item of items) {
        if (!excludedIds.has(item.id)) drawBalloon(ctx, item.params, item.x, item.y, time);
      }
      if (!paused) time += 1 / 60;
      animation = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(animation);
  }, [status, balloons, excludedIds, stageSize, variant, paused]);

  return (
    <div className={`balloon-scene ${className}`} data-renderer={status}>
      <canvas
        key={status === "fallback" ? "fallback" : "webgl"}
        ref={canvasRef}
        className="three-scene-canvas balloon-canvas"
        aria-label={variant === "preview" ? "实时三维气球" : "沉浸式三维气球场景"}
        onClick={status === "fallback" ? (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const point = { x: (event.clientX - rect.left) / rect.width * stageSize.width, y: (event.clientY - rect.top) / rect.height * stageSize.height };
          const items = fallbackItems(variant, balloons, stageSize).filter((item) => !excludedIds.has(item.id));
          const id = hitTestBalloon(items.map((item) => ({ ...item, ...item.params })), point);
          const item = items.find((candidate) => candidate.id === id);
          if (item) callbacks.current.onBalloonClick?.(item.id, { x: item.x, y: item.y });
        } : undefined}
      />
      {status === "loading" ? <div className="scene-loading" role="status"><span />正在布置你的心意…</div> : null}
      {status === "fallback" ? <p className="scene-fallback-note">当前设备已使用兼容画面，送礼功能可正常使用。</p> : (
        <div className="scene-controls" aria-label="场景设置">
          <label className="scene-quality-label">画质
            <select value={quality} onChange={(event) => setQuality(event.target.value as SceneQuality)} aria-label="场景画质">
              <option value="high">精致</option><option value="balanced">流畅</option>
            </select>
          </label>
          <span aria-hidden="true" className="scene-control-divider" />
          <button type="button" className="scene-motion-toggle" onClick={() => setPaused((value) => !value)} aria-label={paused ? "播放动态" : "暂停动态"} aria-pressed={paused}>
            <span aria-hidden="true">{paused ? "▷" : "Ⅱ"}</span><span>{paused ? "播放" : "暂停"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
