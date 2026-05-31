import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { BalloonGift, GiftRoom } from "../../domain/types";
import { createBalloonLayout } from "../../visual/balloonLayout";
import { createBurstFragments, updateFragments, type Fragment } from "../../visual/fragments";
import {
  createResponsiveStageSize,
  DEFAULT_CANVAS_STAGE_SIZE,
  hitTestBalloon,
  useCanvasBalloons
} from "./useCanvasBalloons";

const BURST_ALL_HOLD_MS = 800;
const BURST_FRAGMENT_DELAY_MS = 360;
const BURST_VISUAL_MS = 660;
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
  stretchX: number;
  stretchY: number;
  hue: number;
  burstAll: boolean;
}

interface ActiveFragmentDrag {
  id: string;
  pointerId: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  moved: boolean;
}

export function createBalloonRenderExclusionIds(burstIds: Set<string>, burstingIds: Set<string>) {
  return new Set([...burstIds, ...burstingIds]);
}

function defaultPlayAudio(url: string) {
  const audio = new Audio(url);
  void audio.play();
}

function fragmentLabel(fragment: Fragment) {
  if (fragment.kind === "waveform") return "语音";
  return fragment.content;
}

function isExpiredLocalImageUrl(url: string) {
  return url.startsWith("blob:");
}

function isExpiredLocalAudioUrl(url: string) {
  return url.startsWith("blob:");
}

function sameStageSize(first: { width: number; height: number }, second: { width: number; height: number }) {
  return first.width === second.width && first.height === second.height;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function renderFragmentContent(fragment: Fragment) {
  if (fragment.kind === "particle") return null;
  if (fragment.kind === "image") {
    if (isExpiredLocalImageUrl(fragment.content)) {
      return <span className="fragment-image-fallback">图片已失效，请重新提交</span>;
    }
    return <img className="fragment-image-media" src={fragment.content} alt="上传的图片" loading="lazy" />;
  }
  if (fragment.kind === "waveform" && isExpiredLocalAudioUrl(fragment.audioUrl)) {
    return <span className="fragment-audio-fallback">语音已失效，请重新提交</span>;
  }
  return fragmentLabel(fragment);
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
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [visibleStageSize, setVisibleStageSize] = useState(DEFAULT_CANVAS_STAGE_SIZE);
  const [stageSize, setStageSize] = useState(DEFAULT_CANVAS_STAGE_SIZE);
  const stageFieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burstVisualTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const activeFragmentDragRef = useRef<ActiveFragmentDrag | null>(null);
  const suppressedClickFragmentIdsRef = useRef<Set<string>>(new Set());
  const stageDisplayScale = visibleStageSize.width / stageSize.width;
  const layout = useMemo(() => createBalloonLayout(gifts, stageSize), [gifts, stageSize]);
  const canvasExcludedBalloonIds = useMemo(
    () => createBalloonRenderExclusionIds(burstIds, burstingIds),
    [burstIds, burstingIds]
  );
  useCanvasBalloons(canvasRef, layout, canvasExcludedBalloonIds, stageSize);

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
    const stageElement = stageFieldRef.current;
    if (!stageElement) return undefined;
    const observedStageElement = stageElement;

    function applyVisibleStageSize(size: { width: number; height: number }) {
      const visibleSize = {
        width: Math.round(size.width),
        height: Math.round(size.height)
      };
      if (visibleSize.width <= 0 || visibleSize.height <= 0) return;

      const nextStageSize = createResponsiveStageSize(visibleSize);
      setVisibleStageSize((current) => (sameStageSize(current, visibleSize) ? current : visibleSize));
      setStageSize((current) => (sameStageSize(current, nextStageSize) ? current : nextStageSize));
    }

    function updateFromElement() {
      const rect = observedStageElement.getBoundingClientRect();
      applyVisibleStageSize({
        width: rect.width || window.innerWidth,
        height: rect.height || window.innerHeight
      });
    }

    updateFromElement();
    window.addEventListener("resize", updateFromElement);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateFromElement);
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        applyVisibleStageSize({ width: rect.width, height: rect.height });
      } else {
        updateFromElement();
      }
    });
    observer.observe(observedStageElement);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFromElement);
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
        current.length > 0 ? updateFragments(current, deltaSec, stageSize) : current
      );
      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [fragments.length, stageSize]);

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
    setBurstingIds((current) => new Set(current).add(gift.id));
    setBurstEffects((current) => [
      ...current.filter((effect) => effect.id !== gift.id),
      {
        id: gift.id,
        giverName: gift.giverName,
        x,
        y,
        radius: gift.balloonParams.radius,
        stretchX: gift.balloonParams.stretchX,
        stretchY: gift.balloonParams.stretchY,
        hue: gift.balloonParams.hue,
        burstAll
      }
    ]);
    if (shouldPlayAudio && !isExpiredLocalAudioUrl(gift.audioUrl)) playAudio(gift.audioUrl);

    const fragmentTimer = setTimeout(() => {
      setBurstIds((current) => new Set(current).add(gift.id));
      setFragments((current) => [...current, ...createBurstFragments(gift, { x, y }, burstAll)]);
      burstVisualTimersRef.current = burstVisualTimersRef.current.filter((candidate) => candidate !== fragmentTimer);
    }, BURST_FRAGMENT_DELAY_MS);
    burstVisualTimersRef.current.push(fragmentTimer);

    const finishTimer = setTimeout(() => {
      finishBurst(gift.id);
      burstVisualTimersRef.current = burstVisualTimersRef.current.filter((candidate) => candidate !== finishTimer);
    }, BURST_VISUAL_MS);
    burstVisualTimersRef.current.push(finishTimer);
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
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * stageSize.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * stageSize.height;
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

  function eventToStagePoint(event: PointerEvent<HTMLElement>) {
    const rect = stageFieldRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * stageSize.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * stageSize.height
    };
  }

  function nudgeFragment(fragmentId: string, strength = 1) {
    setFragments((current) =>
      current.map((fragment) => {
        if (fragment.id !== fragmentId) return fragment;
        const angle = fragment.driftPhase + fragment.age * 1.9 + Math.PI * 0.3;
        return {
          ...fragment,
          vx: fragment.vx + Math.cos(angle) * 210 * strength,
          vy: fragment.vy + Math.sin(angle) * 150 * strength - 120 * strength,
          angularVelocity: fragment.angularVelocity + (fragment.kind === "signature" ? 140 : 92) * strength,
          pulse: 1
        };
      })
    );
  }

  function handleFragmentClick(fragment: Fragment) {
    const suppressed = suppressedClickFragmentIdsRef.current;
    if (suppressed.has(fragment.id)) {
      suppressed.delete(fragment.id);
      return;
    }

    if (fragment.kind === "particle") {
      nudgeFragment(fragment.id, 0.72);
      return;
    }
    if (fragment.kind === "image") {
      if (isExpiredLocalImageUrl(fragment.content)) return;
      setSelectedImageUrl(fragment.content);
      nudgeFragment(fragment.id, 0.35);
      return;
    }
    if (fragment.kind === "waveform") {
      if (isExpiredLocalAudioUrl(fragment.audioUrl)) {
        nudgeFragment(fragment.id, 0.45);
        return;
      }
      playAudio(fragment.audioUrl);
      nudgeFragment(fragment.id, 0.52);
      return;
    }
    nudgeFragment(fragment.id);
  }

  function handleFragmentPointerDown(event: PointerEvent<HTMLButtonElement>, fragment: Fragment) {
    if (!event.isPrimary || event.button !== 0) return;
    event.stopPropagation();
    const point = eventToStagePoint(event);
    activeFragmentDragRef.current = {
      id: fragment.id,
      pointerId: event.pointerId,
      lastX: point.x,
      lastY: point.y,
      lastTime: performance.now(),
      moved: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setFragments((current) =>
      current.map((candidate) =>
        candidate.id === fragment.id ? { ...candidate, held: true, vx: 0, vy: 0, pulse: 0.78 } : candidate
      )
    );
  }

  function handleFragmentPointerMove(event: PointerEvent<HTMLButtonElement>, fragment: Fragment) {
    const drag = activeFragmentDragRef.current;
    if (!drag || drag.id !== fragment.id || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = eventToStagePoint(event);
    const now = performance.now();
    const deltaSec = Math.max(0.016, (now - drag.lastTime) / 1000);
    const nextVx = clamp((point.x - drag.lastX) / deltaSec, -900, 900);
    const nextVy = clamp((point.y - drag.lastY) / deltaSec, -900, 900);
    const moved = drag.moved || Math.abs(point.x - drag.lastX) + Math.abs(point.y - drag.lastY) > 4;

    activeFragmentDragRef.current = {
      ...drag,
      lastX: point.x,
      lastY: point.y,
      lastTime: now,
      moved
    };
    setFragments((current) =>
      current.map((candidate) =>
        candidate.id === fragment.id
          ? {
              ...candidate,
              x: clamp(point.x, 24, stageSize.width - 24),
              y: clamp(point.y, 24, stageSize.height - 24),
              vx: nextVx,
              vy: nextVy,
              held: true,
              pulse: 0.92
            }
          : candidate
      )
    );
  }

  function handleFragmentPointerUp(event: PointerEvent<HTMLButtonElement>, fragment: Fragment) {
    const drag = activeFragmentDragRef.current;
    if (!drag || drag.id !== fragment.id || drag.pointerId !== event.pointerId) return;
    activeFragmentDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag.moved) suppressedClickFragmentIdsRef.current.add(fragment.id);
    setFragments((current) =>
      current.map((candidate) =>
        candidate.id === fragment.id
          ? {
              ...candidate,
              held: false,
              angularVelocity: candidate.angularVelocity + clamp(candidate.vx * 0.16, -180, 180),
              pulse: Math.max(candidate.pulse, 0.72)
            }
          : candidate
      )
    );
  }

  return (
    <section className="recipient-stage" aria-label={`${room.title} 收礼现场`}>
      <div className="stage-topbar">
        <strong>{room.recipientName} 的 Balloon Burst Gift</strong>
        <span>{gifts.length} 个匿名气球</span>
      </div>
      <div className="stage-field" ref={stageFieldRef}>
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
                left: `${(effect.x / stageSize.width) * 100}%`,
                top: `${(effect.y / stageSize.height) * 100}%`,
                "--rupture-width": `${effect.radius * 2 * effect.stretchX * stageDisplayScale}px`,
                "--rupture-height": `${effect.radius * 2 * effect.stretchY * stageDisplayScale}px`,
                "--rupture-stretch-x": effect.stretchX,
                "--rupture-stretch-y": effect.stretchY,
                "--rupture-hue": effect.hue
              } as CSSProperties
            }
          >
            <span className="rupture-shell" aria-hidden="true">
              <span className="rupture-crack rupture-crack-primary" />
              <span className="rupture-crack rupture-crack-secondary" />
              <span className="rupture-crack rupture-crack-tertiary" />
            </span>
            <span className="rupture-wave" aria-hidden="true" />
            <span className="latex-flap" aria-hidden="true" />
            {RUPTURE_SHARDS.map((shard) => (
              <span
                key={`${shard.angle}-${shard.distance}`}
                className="rupture-shard"
                style={
                  {
                    "--shard-angle": `${shard.angle}deg`,
                    "--shard-distance": `${effect.radius * stageDisplayScale * shard.distance * (effect.burstAll ? 1.18 : 1)}px`,
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
              left: `${(fragment.x / stageSize.width) * 100}%`,
              top: `${(fragment.y / stageSize.height) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${fragment.rotation}deg) scale(${(1 + fragment.pulse * 0.26).toFixed(2)})`
            }}
            onPointerDown={(event) => handleFragmentPointerDown(event, fragment)}
            onPointerMove={(event) => handleFragmentPointerMove(event, fragment)}
            onPointerUp={(event) => handleFragmentPointerUp(event, fragment)}
            onPointerCancel={(event) => handleFragmentPointerUp(event, fragment)}
            onClick={() => handleFragmentClick(fragment)}
          >
            {renderFragmentContent(fragment)}
          </button>
        ))}
      </div>
      {selectedImageUrl ? (
        <div
          className="image-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="查看上传图片"
          onClick={() => setSelectedImageUrl(null)}
        >
          <div className="image-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <img src={selectedImageUrl} alt="放大的上传图片" />
            <button type="button" className="image-preview-close" onClick={() => setSelectedImageUrl(null)}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
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
