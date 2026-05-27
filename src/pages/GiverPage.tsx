import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRepositories } from "../data/repositoryProvider";
import type { GiftRoom } from "../domain/types";
import { GiverComposer } from "../features/giver/GiverComposer";

export function GiverPage() {
  const { inviteToken = "" } = useParams();
  const { rooms } = useRepositories();
  const [room, setRoom] = useState<GiftRoom | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRoom() {
      const result = await rooms.getRoomByInviteToken(inviteToken);
      if (!active) return;
      setRoom(result);
      setMissing(!result);
    }

    void loadRoom();
    return () => {
      active = false;
    };
  }, [inviteToken, rooms]);

  if (missing) {
    return (
      <main className="page">
        <h1>制作气球礼物</h1>
        <p>邀请链接无效，或者这个礼物房间不存在。</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>制作气球礼物</h1>
      {room ? <GiverComposer room={room} /> : <p>正在读取礼物房间...</p>}
    </main>
  );
}
