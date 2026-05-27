import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRepositories } from "../data/repositoryProvider";
import type { BalloonGift, GiftRoom } from "../domain/types";
import { RecipientStage } from "../features/recipient/RecipientStage";

export function RecipientPage() {
  const { recipientToken = "" } = useParams();
  const { rooms, gifts } = useRepositories();
  const [room, setRoom] = useState<GiftRoom | null>(null);
  const [giftList, setGiftList] = useState<BalloonGift[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const loadedRoom = await rooms.getPublishedRoomByRecipientToken(recipientToken);
      if (!active) return;
      setRoom(loadedRoom);
      setMissing(!loadedRoom);
      if (loadedRoom) {
        const activeGifts = await gifts.listActiveGifts({ roomId: loadedRoom.id, recipientToken });
        if (active) setGiftList(activeGifts);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [gifts, recipientToken, rooms]);

  if (missing) {
    return (
      <main className="page">
        <h1>收礼现场</h1>
        <p>收礼链接无效，或者礼物房间尚未发布。</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="page">
        <h1>收礼现场</h1>
        <p>正在打开气球场...</p>
      </main>
    );
  }

  return <RecipientStage room={room} gifts={giftList} />;
}
