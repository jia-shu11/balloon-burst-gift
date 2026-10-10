import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useRepositories } from "../data/repositoryProvider";
import type { GiftRoom } from "../domain/types";
import { BalloonScene } from "../visual/three/BalloonScene";

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
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!title.trim() || !recipientName.trim()) {
      setError("请填写房间标题和收礼者称呼");
      return;
    }

    setSubmitting(true);
    try {
      const room = await rooms.createRoom({
        title: title.trim(),
        recipientName: recipientName.trim(),
        promptText: promptText.trim()
      });
      rememberCreatedRoom(room);
      setCreatedRoom(room);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建房间失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page home-page">
      <section className="home-hero" aria-labelledby="home-heading">
        <BalloonScene variant="hero" className="home-scene" />

        <header className="home-navigation">
          <Link className="home-brand" to="/" aria-label="Balloon Burst Gift 首页">
            <span className="home-brand-mark" aria-hidden="true">b.</span>
            <span>balloon<span className="home-brand-subtitle">a gift, a little different.</span></span>
          </Link>
          <nav aria-label="首页导航">
            <a href="#how-it-works">一份心意的旅程</a>
            <Link className="home-nav-experience" to="/experience">进入体验 <span aria-hidden="true">↗</span></Link>
          </nav>
        </header>

        <div className="home-hero-copy">
          <p className="home-eyebrow"><span aria-hidden="true" /> FOR SOMEONE SPECIAL</p>
          <h1 className="sr-only">Balloon Burst Gift</h1>
          <h2 id="home-heading">把心意，<br />轻轻放飞。</h2>
          <p className="home-handwritten" lang="en">A little air. A lot of love.</p>
          <p className="home-description">一句祝福，一张合照，一份只属于 TA 的惊喜。<br />把想说的话装进气球，等最特别的人亲手打开。</p>
          <div className="home-hero-actions">
            <a className="home-primary-link" href="#create-room">创建礼物房间 <span aria-hidden="true">↗</span></a>
            <Link className="home-demo-link" to="/experience"><span className="home-play-icon" aria-hidden="true">▷</span> 先看一份惊喜</Link>
          </div>
        </div>

        <div className="home-scene-caption" aria-hidden="true">
          <span>EVERY VOICE, A LITTLE UNIVERSE.</span>
          <span>轻触气球，让心意回响</span>
        </div>

        <footer className="home-hero-footer" id="how-it-works">
          <span className="home-footer-note">让平凡的祝福<br /><em>有不平凡的打开方式。</em></span>
          <ol className="home-journey" aria-label="制作礼物的三个步骤">
            <li><span>01</span>录下心意</li>
            <li><span>02</span>装进气球</li>
            <li><span>03</span>一起打开</li>
          </ol>
          <a className="home-scroll-link" href="#create-room" aria-label="向下滚动，创建礼物房间">开始这份惊喜 <span aria-hidden="true">↓</span></a>
        </footer>
      </section>

      <section className="home-create-section" id="create-room" aria-labelledby="create-room-heading">
        <div className="home-create-copy">
          <span className="home-eyebrow">A SPACE FOR YOUR WISHES</span>
          <h2 id="create-room-heading">这份惊喜，<br />为谁而准备？</h2>
          <p>创建一个小小的空间，邀请朋友留下声音和照片。每一份祝福，都会成为一只独一无二的气球。</p>
          <span className="home-create-signoff">From all of us, with love.</span>
        </div>
        <div className="home-create-content">
          <form className="panel form-grid home-room-form" onSubmit={handleSubmit}>
            <label>
              房间标题
              <input placeholder="例如：小林，生日快乐" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              收礼者称呼
              <input placeholder="这份礼物送给谁" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
            </label>
            <label>
              提示语
              <textarea placeholder="给朋友们一个灵感：说说你们最难忘的一次相遇……" value={promptText} onChange={(event) => setPromptText(event.target.value)} rows={3} />
            </label>
            {error ? <p className="error-text" role="alert">{error}</p> : null}
            <button type="submit" disabled={submitting}>
              {submitting ? "正在创建..." : "创建礼物房间"}
              <span aria-hidden="true">↗</span>
            </button>
            <p className="home-form-note">创建后，把制作链接分享给朋友，一起完成这份礼物。</p>
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
        </div>
      </section>
      <footer className="home-site-footer"><span>balloon</span><p>把你的声音，送到心里。</p><a href="#home-heading">回到顶部 ↑</a></footer>
    </main>
  );
}
