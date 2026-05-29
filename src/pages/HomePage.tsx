import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useRepositories } from "../data/repositoryProvider";
import type { GiftRoom } from "../domain/types";

function absolutePath(path: string) {
  return `${window.location.origin}${path}`;
}

const LAST_CREATED_ROOM_KEY = "balloon-burst-gift:last-created-room";

function isGiftRoom(value: unknown): value is GiftRoom {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GiftRoom>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.inviteToken === "string" &&
    typeof candidate.manageToken === "string"
  );
}

function readLastCreatedRoom() {
  try {
    const raw = sessionStorage.getItem(LAST_CREATED_ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isGiftRoom(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rememberCreatedRoom(room: GiftRoom) {
  try {
    sessionStorage.setItem(LAST_CREATED_ROOM_KEY, JSON.stringify(room));
  } catch {
    // Link display is helpful, but storage failure should not block room creation.
  }
}

export function HomePage() {
  const { rooms } = useRepositories();
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [createdRoom, setCreatedRoom] = useState<GiftRoom | null>(() => readLastCreatedRoom());
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!title.trim() || !recipientName.trim()) {
      setError("请填写房间标题和收礼者称呼");
      return;
    }

    const room = await rooms.createRoom({
      title: title.trim(),
      recipientName: recipientName.trim(),
      promptText: promptText.trim()
    });
    rememberCreatedRoom(room);
    setCreatedRoom(room);
  }

  return (
    <main className="page home-page">
      <section className="hero-copy">
        <h1>Balloon Burst Gift</h1>
        <p>创建一个由声音吹大的集体气球礼物。</p>
      </section>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <label>
          房间标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          收礼者称呼
          <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
        </label>
        <label>
          提示语
          <textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} rows={3} />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">创建礼物房间</button>
      </form>

      {createdRoom ? (
        <section className="panel link-output" aria-live="polite">
          <h2>房间已创建</h2>
          <h3>送礼者制作链接</h3>
          <p>
            <Link to={`/gift/${createdRoom.inviteToken}`}>{absolutePath(`/gift/${createdRoom.inviteToken}`)}</Link>
          </p>
          <h3>组织者管理链接</h3>
          <p>
            <Link to={`/manage/${createdRoom.manageToken}`}>{absolutePath(`/manage/${createdRoom.manageToken}`)}</Link>
          </p>
        </section>
      ) : null}
    </main>
  );
}
