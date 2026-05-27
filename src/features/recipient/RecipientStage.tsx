import { useMemo, useState } from "react";
import type { BalloonGift, GiftRoom } from "../../domain/types";
import { createBalloonLayout } from "../../visual/balloonLayout";
import { createBurstFragments, type Fragment } from "../../visual/fragments";

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
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const layout = useMemo(() => createBalloonLayout(gifts, { width: 1200, height: 720 }), [gifts]);

  function burstGift(gift: BalloonGift, x: number, y: number) {
    if (burstIds.has(gift.id)) return;
    setBurstIds((current) => new Set(current).add(gift.id));
    setFragments((current) => [...current, ...createBurstFragments(gift, { x, y }, false)]);
    playAudio(gift.audioUrl);
  }

  function burstAll() {
    const remaining = layout.filter((item) => !burstIds.has(item.gift.id));
    setBurstIds(new Set(gifts.map((gift) => gift.id)));
    setFragments((current) => [
      ...current,
      ...remaining.flatMap((item) => createBurstFragments(item.gift, { x: item.x, y: item.y }, true))
    ]);
  }

  return (
    <section className="recipient-stage" aria-label={`${room.title} 收礼现场`}>
      <div className="stage-topbar">
        <strong>{room.recipientName} 的 Balloon Burst Gift</strong>
        <span>{gifts.length} 个匿名气球</span>
      </div>
      <div className="stage-field">
        {layout.map((item, index) =>
          burstIds.has(item.gift.id) ? null : (
            <button
              key={item.gift.id}
              type="button"
              className="stage-balloon-hotspot"
              style={{
                left: `${(item.x / 1200) * 100}%`,
                top: `${(item.y / 720) * 100}%`,
                width: item.gift.balloonParams.radius * 2,
                height: item.gift.balloonParams.radius * 2
              }}
              aria-label={`爆破匿名气球 ${index + 1}`}
              onClick={() => burstGift(item.gift, item.x, item.y)}
            />
          )
        )}
        {fragments.map((fragment) => (
          <button
            key={fragment.id}
            type="button"
            className={`fragment fragment-${fragment.kind}`}
            style={{
              left: `${(fragment.x / 1200) * 100}%`,
              top: `${(fragment.y / 720) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${fragment.rotation}deg)`
            }}
            onClick={() => fragment.kind !== "particle" && playAudio(fragment.audioUrl)}
          >
            {fragment.kind === "particle" ? "" : fragmentLabel(fragment)}
          </button>
        ))}
      </div>
      <button type="button" className="burst-all-control" onClick={burstAll} aria-label="长按蓄能，全场爆炸">
        长按蓄能，全场爆炸
      </button>
    </section>
  );
}
