import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRepositories } from "../data/repositoryProvider";
import type { GiftRoom } from "../domain/types";
import { ManageRoom } from "../features/manage/ManageRoom";

export function ManagePage() {
  const { manageToken = "" } = useParams();
  const { rooms } = useRepositories();
  const [room, setRoom] = useState<GiftRoom | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRoom() {
      const result = await rooms.getRoomByManageToken(manageToken);
      if (!active) return;
      setRoom(result);
      setMissing(!result);
    }

    void loadRoom();
    return () => {
      active = false;
    };
  }, [manageToken, rooms]);

  if (missing) {
    return (
      <main className="page">
        <h1>管理礼物房间</h1>
        <p>管理链接无效，或者这个房间不存在。</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>管理礼物房间</h1>
      {room ? <ManageRoom room={room} /> : <p>正在读取房间...</p>}
    </main>
  );
}
