export type TranscriptSource = "speech-recognition" | "manual";

export interface TranscriptResult {
  source: TranscriptSource;
  text: string;
}

interface SpeechRecognitionAlternative {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionAlternative;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function createManualTranscript(text: string): TranscriptResult {
  return {
    source: "manual",
    text: normalizeTranscript(text)
  };
}

export function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function startSpeechTranscription(onTranscript: (result: TranscriptResult) => void) {
  const Constructor = getSpeechRecognitionConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    const text = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ");

    onTranscript({
      source: "speech-recognition",
      text: normalizeTranscript(text)
    });
  };
  recognition.onerror = () => {
    onTranscript({ source: "manual", text: "" });
  };

  try {
    recognition.start();
  } catch {
    onTranscript({ source: "manual", text: "" });
    return null;
  }

  return () => recognition.stop();
}
