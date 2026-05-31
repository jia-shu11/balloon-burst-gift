import type { BalloonMood } from "./types";

export interface BalloonMoodOption {
  value: BalloonMood;
  label: string;
  description: string;
  hue: number;
  hueVariance: number;
  wobbleBias: number;
  glowBias: number;
  floatBias: number;
  fragmentBias: number;
}

export const BALLOON_MOOD_OPTIONS: BalloonMoodOption[] = [
  {
    value: "gentle",
    label: "温柔",
    description: "慢一点、柔一点，像轻轻包住祝福",
    hue: 155,
    hueVariance: 50,
    wobbleBias: -0.08,
    glowBias: 0.04,
    floatBias: -0.04,
    fragmentBias: -1
  },
  {
    value: "bright",
    label: "明亮",
    description: "更清透，适合直接又开心的祝福",
    hue: 52,
    hueVariance: 46,
    wobbleBias: 0,
    glowBias: 0.1,
    floatBias: 0,
    fragmentBias: 0
  },
  {
    value: "playful",
    label: "淘气",
    description: "弹跳感更明显，碎片也更活泼",
    hue: 322,
    hueVariance: 44,
    wobbleBias: 0.12,
    glowBias: 0.02,
    floatBias: 0.08,
    fragmentBias: 2
  },
  {
    value: "secret",
    label: "秘密",
    description: "暗一点、慢一点，像悄悄递出的心意",
    hue: 245,
    hueVariance: 50,
    wobbleBias: -0.04,
    glowBias: -0.02,
    floatBias: -0.06,
    fragmentBias: 0
  },
  {
    value: "celebrate",
    label: "庆祝",
    description: "更热烈，适合集体祝福和惊喜时刻",
    hue: 12,
    hueVariance: 50,
    wobbleBias: 0.08,
    glowBias: 0.12,
    floatBias: 0.05,
    fragmentBias: 3
  }
];

export function getBalloonMoodOption(mood: BalloonMood | undefined) {
  return BALLOON_MOOD_OPTIONS.find((option) => option.value === mood) ?? null;
}
