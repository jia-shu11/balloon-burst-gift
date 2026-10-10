import { useState } from "react";
import { Link } from "react-router-dom";
import { RecipientStage } from "../features/recipient/RecipientStage";
import { experienceGifts, experienceRoom } from "../visual/three/demoData";

export function ExperiencePage() {
  const [session, setSession] = useState(0);
  return <main className="experience-page">
    <nav className="experience-nav" aria-label="体验导航">
      <Link to="/">← 返回首页</Link><span>体验空间</span>
      <button type="button" onClick={() => setSession((value) => value + 1)}>重新体验 ↻</button>
    </nav>
    <RecipientStage key={session} room={experienceRoom} gifts={experienceGifts} playAudio={() => undefined} />
  </main>;
}
