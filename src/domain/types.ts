export type RoomStatus = "draft" | "published";
export type BalloonMood = "gentle" | "bright" | "playful" | "secret" | "celebrate";

export interface GiftRoom {
  id: string;
  title: string;
  recipientName: string;
  promptText: string;
  inviteToken: string;
  manageToken: string;
  recipientToken: string;
  status: RoomStatus;
  createdAt: string;
  publishedAt: string | null;
}

export interface BalloonGift {
  id: string;
  roomId: string;
  giverName: string;
  audioUrl: string;
  audioDurationSec: number;
  averageVolume: number;
  peakVolume: number;
  transcript: string;
  editedTranscript: string;
  extraText: string;
  imageUrls: string[];
  imageBytes: number;
  balloonParams: BalloonParams;
  deletedAt: string | null;
  createdAt: string;
}

export interface BalloonParams {
  radius: number;
  stretchX: number;
  stretchY: number;
  wobble: number;
  glow: number;
  surfaceWaveDensity: number;
  floatSpeed: number;
  stringLength: number;
  fragmentCount: number;
  burstRadius: number;
  hue: number;
}

export interface GiftInputMetrics {
  seed: string;
  mood?: BalloonMood;
  audioDurationSec: number;
  averageVolume: number;
  peakVolume: number;
  transcriptChars: number;
  extraTextChars: number;
  imageCount: number;
  imageBytes: number;
}
