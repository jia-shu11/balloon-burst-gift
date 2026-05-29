import { type CSSProperties, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BalloonGift, GiftRoom } from "../../domain/types";
import { createBalloonLayout } from "../../visual/balloonLayout";
import { createBurstFragments, updateFragments, type Fragment } from "../../visual/fragments";
import { hitTestBalloon, useCanvasBalloons } from "./useCanvasBalloons";

const BURST_ALL_HOLD_MS = 800;
const BURST_VISUAL_MS = 240;
const STAGE_WIDTH = 1200;
const STAGE_HEIGHT = 720;
const RUPTURE_SHARDS = [
  { angle: -18, distance: 0.62, rotate: -52 },
  { angle: 26, distance: 0.78, rotate: 28 },
  { angle: 74, distance: 0.58, rotate: 76 },
  { angle: 138, distance: 0.72, rotate: 134 },
  { angle: 214, distance: 0.64, rotate: 210 },
  { angle: 286, distance: 0.76, rotate: 288 }
];

interface BurstEffect {
  id: string;
  giverName: string;
  x: number;
  y: number;
  radius: number;
  hue: number;
  burstAll: boolean;
}

function defaultPlayAudio(url: string) {
  const audio = new Audio(url);
  void audio.play();
}

function fragmentLabel(fragment: Fragment) {
  if (fragment.kind === "waveform") return "语音";
  return fragment.content;
}

export function RecipientStage({
  room,
  gifts,
  playAudio = defaultPlayAudio
}: {
  room: GiftRoom;
  gifts: BalloonGift[];
  playAudio?: (url: string) => void;
}) {
  const [burstIds, setBurstIds] = useState<Set<string>>(() => new Set());
  const [burstingIds, setBurstingIds] = useState<Set<string>>(() => new Set());
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [burstEffects, setBurstEffects] = useState<BurstEffect[]>([]);
  const [burstAllCharge, setBurstAllCharge] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burstVisualTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const layout = useMemo(() => createBalloonLayout(gifts, { width: STAGE_WIDTH, height: STAGE_HEIGHT }), [gifts]);
  useCanvasBalloons(canvasRef, layout, burstIds);

  function clearBurstAllTimers() {
    if (burstAllTimerRef.current !== null) {
      clearTimeout(burstAllTimerRef.current);
      burstAllTimerRef.current = null;
    }
    if (chargeTimerRef.current !== null) {
      clearInterval(chargeTimerRef.current);
      chargeTimerRef.current = null;
    }
  }

  function clearBurstVisualTimers() {
    for (const timer of burstVisualTimersRef.current) {
      clearTimeout(timer);
    }
    burstVisualTimersRef.current = [];
  }

  useEffect(() => {
    return () => {
      clearBurstAllTimers();
      clearBurstVisualTimers();
    };
  }, []);

  useEffect(() => {
    if (fragments.length === 0) return;
    let animationId = 0;
    let previousTime = performance.now();

    function animate(nextTime: number) {
      const deltaSec = Math.min(0.05, Math.max(0, (nextTime - previousTime) / 1000));
      previousTime = nextTime;
      setFragments((current) =>
        current.length > 0 ? updateFragments(current, deltaSec, { width: STAGE_WIDTH, height: STAGE_HEIGHT }) : current
      );
      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [fragments.length]);

  function finishBurst(giftId: string) {
    setBurstingIds((current) => {
      const next = new Set(current);
      next.delete(giftId);
      return next;
    });
    setBurstEffects((current) => current.filter((effect) => effect.id !== giftId));
  }

  function queueBurst(gift: BalloonGift, x: number, y: number, burstAll: boolean, shouldPlayAudio: boolean) {
    if (burstIds.has(gift.id) || burstingIds.has(gift.id)) return;
    setBurstIds((current) => new Set(current).add(gift.id));
    setBurstingIds((current) => new Set(current).add(gift.id));
    setBurstEffects((current) => [
      ...current.filter((effect) => effect.id !== gift.id),
      {
        id: gift.id,
        giverName: gift.giverName,
        x,
        y,
        radius: gift.balloonParams.radius,
        hue: gift.balloonParams.hue,
        burstAll
      }
    ]);
    setFragments((current) => [...current, ...createBurstFragments(gift, { x, y }, burstAll)]);
    if (shouldPlayAudio) playAudio(gift.audioUrl);

    const timer = setTimeout(() => {
      finishBurst(gift.id);
      burstVisualTimersRef.current = burstVisualTimersRef.current.filter((candidate) => candidate !== timer);
    }, BURST_VISUAL_MS);
    burstVisualTimersRef.current.push(timer);
  }

  function burstGift(gift: BalloonGift, x: number, y: number) {
    queueBurst(gift, x, y, false, true);
  }

  function burstAll() {
    const remaining = layout.filter((item) => !burstIds.has(item.gift.id) && !burstingIds.has(item.gift.id));
    clearBurstAllTimers();
    setBurstAllCharge(0);
    if (remaining.length === 0) return;
    for (const item of remaining) {
      queueBurst(item.gift, item.x, item.y, true, false);
    }
  }

  function startBurstAllHold() {
    if (gifts.length === 0) return;
    clearBurstAllTimers();
    const startedAt = Date.now();
    setBurstAllCharge(0.08);
    chargeTimerRef.current = setInterval(() => {
      setBurstAllCharge(Math.min(0.98, (Date.now() - startedAt) / BURST_ALL_HOLD_MS));
    }, 80);
    burstAllTimerRef.current = setTimeout(() => {
      setBurstAllCharge(1);
      burstAll();
    }, BURST_ALL_HOLD_MS);
  }

  function cancelBurstAllHold() {
    if (burstAllTimerRef.current === null) return;
    clearBurstAllTimers();
    setBurstAllCharge(0);
  }

  function handleBurstAllKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    startBurstAllHold();
  }

  function handleBurstAllKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    cancelBurstAllHold();
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * STAGE_WIDTH;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * STAGE_HEIGHT;
    const hitId = hitTestBalloon(
      layout
        .filter((item) => !burstIds.has(item.gift.id) && !burstingIds.has(item.gift.id))
        .map((item) => ({
          id: item.gift.id,
          x: item.x,
          y: item.y,
          radius: item.gift.balloonParams.radius,
          stretchX: item.gift.balloonParams.stretchX,
          stretchY: item.gift.balloonParams.stretchY
        })),
      { x, y }
    );
    const item = layout.find((candidate) => candidate.gift.id === hitId);
    if (item) burstGift(item.gift, item.x, item.y);
  }

  return (
    <section className="recipient-stage" aria-label={`${room.title} 收礼现场`}>
      <div className="stage-topbar">
        <strong>{room.recipientName} 的 Balloon Burst Gift</strong>
        <span>{gifts.length} 个匿名气球</span>
      </div>
      <div className="stage-field">
        <canvas ref={canvasRef} className="balloon-canvas" onClick={handleCanvasClick} />
        {gifts.length === 0 ? (
          <div className="stage-empty-state">
            <h2>礼物还在准备中</h2>
            <p>发布前至少保留一个气球，打开现场时才会有完整的爆破体验。</p>
          </div>
        ) : null}
        {layout.map((item, index) =>
          burstIds.has(item.gift.id) || burstingIds.has(item.gift.id) ? null : (
            <button
              key={item.gift.id}
              type="button"
              className="sr-only"
              aria-label={`爆破匿名气球 ${index + 1}`}
              onClick={() => burstGift(item.gift, item.x, item.y)}
            />
          )
        )}
        {burstEffects.map((effect) => (
          <div
            key={effect.id}
            role="img"
            aria-label={`${effect.giverName} 的气球破裂动画`}
            className={`rupture-effect${effect.burstAll ? " rupture-effect-all" : ""}`}
            style={
              {
                left: `${(effect.x / STAGE_WIDTH) * 100}%`,
                top: `${(effect.y / STAGE_HEIGHT) * 100}%`,
                "--rupture-size": `${effect.radius * (effect.burstAll ? 2.4 : 1.78)}px`,
                "--rupture-hue": effect.hue
              } as CSSProperties
            }
          >
            <span className="rupture-wave" aria-hidden="true" />
            <span className="latex-flap" aria-hidden="true" />
            {RUPTURE_SHARDS.map((shard) => (
              <span
                key={`${shard.angle}-${shard.distance}`}
                className="rupture-shard"
                style={
                  {
                    "--shard-angle": `${shard.angle}deg`,
                    "--shard-distance": `${effect.radius * shard.distance * (effect.burstAll ? 1.18 : 1)}px`,
                    "--shard-rotate": `${shard.rotate}deg`
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            ))}
          </div>
        ))}
        {fragments.map((fragment) => (
          <button
            key={fragment.id}
            type="button"
            className={`fragment fragment-${fragment.kind}`}
            style={{
              left: `${(fragment.x / STAGE_WIDTH) * 100}%`,
              top: `${(fragment.y / STAGE_HEIGHT) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${fragment.rotation}deg)`
            }}
            onClick={() => fragment.kind !== "particle" && playAudio(fragment.audioUrl)}
          >
            {fragment.kind === "particle" ? "" : fragmentLabel(fragment)}
          </button>
        ))}
      </div>
      {gifts.length > 0 ? (
        <button
          type="button"
          className={`burst-all-control${burstAllCharge > 0 ? " is-charging" : ""}`}
          style={{ "--burst-charge": burstAllCharge } as CSSProperties}
          onPointerDown={startBurstAllHold}
          onPointerUp={cancelBurstAllHold}
          onPointerCancel={cancelBurstAllHold}
          onPointerLeave={cancelBurstAllHold}
          onKeyDown={handleBurstAllKeyDown}
          onKeyUp={handleBurstAllKeyUp}
          aria-label="长按蓄能，全场爆炸"
        >
          <span className="burst-charge-fill" aria-hidden="true" />
          <span>{burstAllCharge > 0 ? `蓄能 ${Math.round(burstAllCharge * 100)}%` : "长按蓄能，全场爆炸"}</span>
        </button>
      ) : null}
    </section>
  );
}
