import { generateBalloonParams } from "../../domain/balloonParams";
import type { BalloonGift, GiftRoom } from "../../domain/types";
import type { SceneBalloon } from "./types";

const hues = [34, 345, 160, 42, 215, 18, 275];
export const showcaseBalloons: SceneBalloon[] = hues.map((hue, index) => ({
  id: `showcase-${index}`,
  params: {
    ...generateBalloonParams({ seed: `atelier-${index}`, audioDurationSec: 12, averageVolume: 0.12, peakVolume: 0.3, transcriptChars: 12, extraTextChars: 0, imageCount: 0, imageBytes: 0, selectedHue: hue }),
    spikeCount: 0,
    stretchX: 1,
    stretchY: 1.12,
    radius: 90,
    lightness: [60, 66, 60, 72, 68, 64, 64][index],
    stringLength: 110
  }
}));

export const experienceRoom: GiftRoom = {
  id: "experience", title: "把喜欢，轻轻打开。", recipientName: "此刻的你", promptText: "每一份心意，都值得被好好珍藏。",
  inviteToken: "", manageToken: "", recipientToken: "", status: "published", createdAt: "2026-10-04T00:00:00Z", publishedAt: "2026-10-04T00:00:00Z"
};

const wishes = ["愿你每一天，都被温柔以待。", "把所有好心情，都送给你。", "慢一点也没关系，你一直在发光。", "愿你的每一个小小心愿，都有回声。", "今天，也要记得为自己开心。", "很高兴，在这个世界遇见你。", "下一场美好，正在路上。"];
export const experienceGifts: BalloonGift[] = showcaseBalloons.map((balloon, index) => ({
  id: balloon.id, roomId: "experience", giverName: ["小满", "阿宁", "星野", "林间", "鹿鹿", "予安", "晴天"][index],
  audioUrl: "", audioDurationSec: 0, averageVolume: 0, peakVolume: 0, transcript: "", editedTranscript: wishes[index], extraText: "",
  imageUrls: [], imageBytes: 0, balloonParams: { ...balloon.params, radius: 82, fragmentCount: 10 }, deletedAt: null, createdAt: "2026-10-04T00:00:00Z"
}));
