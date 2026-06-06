export type RoomStatus = "draft" | "published";

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

export interface AudioFeatureSummary {
  durationSec: number;
  spectralCentroid: number;
  rmsEnergy: number;
  peakEnergy: number;
  speechRate: number;
  melBands: number[];
  voiceSignature?: VoiceGiftSignature;
}

export interface VoicePause {
  position: number;
  strength: number;
}

export interface VoiceGiftSignature {
  durationSec: number;
  energyEnvelope: number[];
  waveformContour: number[];
  melTexture: number[];
  pausePattern: VoicePause[];
  rhythmDensity: number;
  pitchAccent: number;
  dynamicRange: number;
}

export interface BalloonParams {
  radius: number;
  stretchX: number;
  stretchY: number;
  wobble: number;
  glow: number;
  lightness: number;
  surfaceWaveDensity: number;
  floatSpeed: number;
  stringLength: number;
  fragmentCount: number;
  burstRadius: number;
  hue: number;
  spikeCount: number;
  spikeLength: number;
  audioFeatures: AudioFeatureSummary;
  voiceSignature: VoiceGiftSignature;
}

export interface GiftInputMetrics {
  seed: string;
  audioDurationSec: number;
  averageVolume: number;
  peakVolume: number;
  transcriptChars: number;
  extraTextChars: number;
  imageCount: number;
  imageBytes: number;
  selectedHue?: number;
  audioFeatures?: AudioFeatureSummary;
  voiceSignature?: VoiceGiftSignature;
}
