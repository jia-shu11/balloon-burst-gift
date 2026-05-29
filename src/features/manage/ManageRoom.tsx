import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRepositories } from "../../data/repositoryProvider";
import type { BalloonGift, GiftRoom } from "../../domain/types";

function recipientUrl(token: string) {
  return `${window.location.origin}/r/${token}`;
}

function recipientPath(token: string) {
  return `/r/${token}`;
}

export function ManageRoom({ room: initialRoom }: { room: GiftRoom }) {
  const { rooms, gifts } = useRepositories();
  const [room, setRoom] = useState(initialRoom);
  const [giftList, setGiftList] = useState<BalloonGift[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    setGiftList(await gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken }));
  }

  useEffect(() => {
    let active = true;

    async function loadGifts() {
      try {
        const activeGifts = await gifts.listActiveGifts({ roomId: room.id, manageToken: room.manageToken });
        if (active) setGiftList(activeGifts);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "读取气球失败");
      }
    }

    void loadGifts();
    return () => {
      active = false;
    };
  }, [gifts, room.id, room.manageToken]);

  async function deleteGift(gift: BalloonGift) {
    setError("");
    await gifts.deleteGift({ giftId: gift.id, manageToken: room.manageToken });
    await refresh();
  }

  async function publish() {
    setError("");
    if (giftList.length === 0) {
      setError("至少收到一个气球后再发布收礼链接。");
      return;
    }
    const published = await rooms.publishRoom(room.manageToken);
    setRoom(published);
  }

  const publishDisabled = room.status === "published" || giftList.length === 0;

  return (
    <section className="panel manage-room">
      <div className="manage-room-header">
        <div>
          <h2>{room.title}</h2>
          <p>收礼者：{room.recipientName}</p>
        </div>
        <button type="button" onClick={publish} disabled={publishDisabled}>
          {room.status === "published" ? "已发布收礼链接" : "发布收礼链接"}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {giftList.length === 0 && room.status !== "published" ? (
        <p className="muted-text">至少收到一个气球后再发布收礼链接。</p>
      ) : null}

      {giftList.length === 0 ? (
        <p>当前没有有效气球</p>
      ) : (
        <ul className="gift-list">
          {giftList.map((gift) => (
            <li key={gift.id}>
              <strong>{gift.giverName}</strong>
              <span>{gift.editedTranscript || gift.transcript || gift.extraText || "一段语音祝福"}</span>
              <button type="button" onClick={() => deleteGift(gift)} aria-label={`删除 ${gift.giverName} 的气球`}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      {room.status === "published" ? (
        <div className="recipient-link">
          <strong>收礼链接</strong>
          <p>
            <Link to={recipientPath(room.recipientToken)}>{recipientUrl(room.recipientToken)}</Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
