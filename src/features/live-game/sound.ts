"use client";

/**
 * Lightweight WebAudio synth for live-game feedback sounds. No audio assets —
 * everything is generated. All calls are safe no-ops when the browser blocks
 * audio (autoplay policy) or the user muted sounds.
 */

const MUTE_STORAGE_KEY = "duocards_live_sound_muted";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isLiveSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLiveSoundMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_STORAGE_KEY, "1");
    else localStorage.removeItem(MUTE_STORAGE_KEY);
  } catch {
    // Preference simply won't persist.
  }
}

interface Tone {
  frequency: number;
  /** Offset from now, in seconds. */
  at?: number;
  duration?: number;
  volume?: number;
  type?: OscillatorType;
}

function play(tones: Tone[]): void {
  if (isLiveSoundMuted()) return;
  const audio = audioContext();
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (const tone of tones) {
    const start = now + (tone.at ?? 0);
    const duration = tone.duration ?? 0.12;
    const volume = tone.volume ?? 0.08;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}

/** Short tick for the last seconds of the question countdown. */
export function playCountdownTick(secondsLeft: number): void {
  play([
    {
      frequency: secondsLeft <= 2 ? 1180 : 880,
      duration: 0.07,
      volume: 0.05,
      type: "square",
    },
  ]);
}

/** Player answered correctly (reveal screen). */
export function playCorrect(): void {
  play([
    { frequency: 660, duration: 0.12 },
    { frequency: 880, at: 0.1, duration: 0.16 },
  ]);
}

/** Player answered wrong or ran out of time (reveal screen). */
export function playIncorrect(): void {
  play([
    { frequency: 330, duration: 0.16, type: "triangle" },
    { frequency: 220, at: 0.14, duration: 0.22, type: "triangle" },
  ]);
}

/** New question appeared. */
export function playQuestionStart(): void {
  play([{ frequency: 523, duration: 0.1 }, { frequency: 784, at: 0.08, duration: 0.12 }]);
}

/** Winner fanfare on the final screen. */
export function playFanfare(): void {
  play([
    { frequency: 523, duration: 0.16, volume: 0.1 },
    { frequency: 659, at: 0.14, duration: 0.16, volume: 0.1 },
    { frequency: 784, at: 0.28, duration: 0.16, volume: 0.1 },
    { frequency: 1047, at: 0.42, duration: 0.4, volume: 0.12 },
    { frequency: 784, at: 0.42, duration: 0.4, volume: 0.06 },
  ]);
}
