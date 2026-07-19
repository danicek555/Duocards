"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

type StudySound = "flip" | "know" | "dontKnow";

let studyAudioContext: AudioContext | null = null;

function playStudySound(sound: StudySound) {
  if (typeof window === "undefined") return;

  try {
    studyAudioContext ??= new AudioContext();
    const context = studyAudioContext;
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const notes: Array<{
      frequency: number;
      endFrequency?: number;
      start: number;
      duration: number;
    }> =
      sound === "know"
        ? [
            { frequency: 523.25, start: 0, duration: 0.09 },
            { frequency: 659.25, start: 0.065, duration: 0.13 },
          ]
        : sound === "dontKnow"
          ? [{ frequency: 245, endFrequency: 190, start: 0, duration: 0.13 }]
          : [{ frequency: 430, endFrequency: 510, start: 0, duration: 0.06 }];

    notes.forEach(({ frequency, endFrequency, start, duration }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startsAt = now + start;
      const endsAt = startsAt + duration;

      oscillator.type = sound === "know" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endsAt);
      }

      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(
        sound === "know" ? 0.045 : 0.025,
        startsAt + 0.012
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startsAt);
      oscillator.stop(endsAt + 0.01);
    });
  } catch {
    // Audio feedback is optional; studying must continue if sound is blocked.
  }
}

interface FlashcardProps {
  word: string;
  translation: string;
  difficulty: number;
  pronunciation?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
  onDontKnow?: () => void;
  onKnow?: () => void;
  learnedCount?: number;
  totalCount?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export default function Flashcard({
  word,
  translation,
  difficulty,
  pronunciation,
  imageUrl,
  audioUrl,
  onDontKnow,
  onKnow,
  learnedCount = 0,
  totalCount = 0,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}: FlashcardProps) {
  const { t } = useI18n();
  const [isFlipped, setIsFlipped] = useState(false);
  const [decision, setDecision] = useState<"know" | "dontKnow" | null>(null);
  const decisionTimerRef = useRef<number | null>(null);
  const isStudyMode = Boolean(onDontKnow && onKnow);

  // Reset flip when word or translation changes to ensure we always start with English side
  useEffect(() => {
    setIsFlipped(false);
    setDecision(null);
  }, [word, translation]);

  useEffect(
    () => () => {
      if (decisionTimerRef.current !== null) {
        window.clearTimeout(decisionTimerRef.current);
      }
    },
    []
  );

  const handleFlip = () => {
    if (decision) return;
    playStudySound("flip");
    setIsFlipped((flipped) => !flipped);
  };

  const runDecision = useCallback(
    (nextDecision: "know" | "dontKnow", action?: () => void) => {
      if (!action || decision) return;

      setIsFlipped(false);
      setDecision(nextDecision);
      decisionTimerRef.current = window.setTimeout(() => {
        setDecision(null);
        action();
      }, 210);
    },
    [decision]
  );

  const markDontKnow = useCallback(() => {
    if (!decision && onDontKnow) playStudySound("dontKnow");
    runDecision("dontKnow", onDontKnow);
  }, [decision, onDontKnow, runDecision]);

  const markKnow = useCallback(() => {
    if (!decision && onKnow) playStudySound("know");
    runDecision("know", onKnow);
  }, [decision, onKnow, runDecision]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (event.code === "Space") {
        if (decision) return;
        event.preventDefault();
        playStudySound("flip");
        setIsFlipped((flipped) => !flipped);
      } else if (event.key === "ArrowLeft") {
        if (!onDontKnow) return;
        event.preventDefault();
        markDontKnow();
      } else if (event.key === "ArrowRight") {
        if (!onKnow) return;
        event.preventDefault();
        markKnow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [decision, markDontKnow, markKnow, onDontKnow, onKnow]);

  const playAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => {
        console.error("Error playing audio:", err);
      });
    }
  };

  const handleAudioButtonClick = (
    e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    playAudio();
  };

  const handleAudioPointerDown = (
    e:
      | React.MouseEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
  };

  const difficultyConfig = {
    1: {
      bg: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30",
      border: "border-green-300 dark:border-green-700",
      accent: "text-green-600 dark:text-green-400",
      accentBg: "bg-green-600 dark:bg-green-400",
    },
    2: {
      bg: "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30",
      border: "border-yellow-300 dark:border-yellow-700",
      accent: "text-yellow-600 dark:text-yellow-400",
      accentBg: "bg-yellow-600 dark:bg-yellow-400",
    },
    3: {
      bg: "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30",
      border: "border-orange-300 dark:border-orange-700",
      accent: "text-orange-600 dark:text-orange-400",
      accentBg: "bg-orange-600 dark:bg-orange-400",
    },
    4: {
      bg: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30",
      border: "border-red-300 dark:border-red-700",
      accent: "text-red-600 dark:text-red-400",
      accentBg: "bg-red-600 dark:bg-red-400",
    },
  };

  const config =
    difficultyConfig[difficulty as keyof typeof difficultyConfig] ||
    difficultyConfig[1];

  // Parse translation to detect format
  const parseTranslation = () => {
    const trimmedTranslation = translation.trim();

    // Check if it's in "word: phrase" format
    if (trimmedTranslation.includes(":")) {
      const parts = trimmedTranslation.split(":").map((p) => p.trim());
      if (parts.length >= 2) {
        return {
          type: "both" as const,
          word: parts[0],
          phrase: parts.slice(1).join(":"), // In case there are multiple colons
        };
      }
    }

    // Check if it's a phrase (multiple words, longer text)
    const wordCount = trimmedTranslation.split(/\s+/).length;
    if (wordCount > 3 || trimmedTranslation.length > 20) {
      return {
        type: "phrase" as const,
        text: trimmedTranslation,
      };
    }

    // Single word (default)
    return {
      type: "word" as const,
      text: trimmedTranslation,
    };
  };

  const translationData = parseTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 w-full px-4 py-2">
      {/* Flashcard */}
      <div className="w-full max-w-xl flex-1 min-h-0 flex flex-col items-center justify-center">
        {/* Flashcard Card */}
        <div className="relative w-full flex-1 min-h-[200px] max-h-[min(380px,calc(100vh-12rem))]">
          <div
            key={`card-${word}-${translation}`}
            className={`relative h-full w-full cursor-pointer perspective-1000 ${
              decision === "know"
                ? "flashcard-exit-know"
                : decision === "dontKnow"
                  ? "flashcard-exit-dont-know"
                  : "flashcard-enter"
            }`}
            onClick={handleFlip}
          >
            <div
              className={`relative w-full h-full preserve-3d transition-transform duration-500 ${
                isFlipped ? "rotate-y-180" : ""
              }`}
            >
              {/* Front side */}
              <div
                className={`absolute inset-0 backface-hidden ${config.border} rounded-2xl shadow-2xl border-2 flex flex-col items-center justify-center p-8 overflow-hidden`}
                style={
                  imageUrl
                    ? {
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}
                }
              >
                {/* Overlay for text readability */}
                {imageUrl && (
                  <div className="absolute inset-0 bg-black/40 dark:bg-black/60 rounded-2xl"></div>
                )}
                {/* Background gradient when no image */}
                {!imageUrl && (
                  <div
                    className={`absolute inset-0 ${config.bg} rounded-2xl`}
                  ></div>
                )}

                <div className="text-center w-full relative z-10">
                  <div className="flex items-center justify-center mb-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        imageUrl
                          ? "bg-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                          : config.accentBg
                      } mr-2`}
                    ></div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        imageUrl
                          ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                          : config.accent
                      }`}
                    >
              {t("flashcard.word")}
                    </p>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        imageUrl
                          ? "bg-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                          : config.accentBg
                      } ml-2`}
                    ></div>
                  </div>
                  <h2
                    className={`text-5xl md:text-6xl font-bold mb-6 leading-tight break-words px-4 ${
                      imageUrl
                        ? "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {word}
                  </h2>
                  <p
                    className={`text-xs mt-4 font-medium ${
                      imageUrl
                        ? "text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
              {t("flashcard.reveal")}
                  </p>
                </div>
              </div>

              {/* Back side */}
              <div
                className={`absolute inset-0 backface-hidden rotate-y-180 ${config.border} rounded-2xl shadow-2xl border-2 flex flex-col items-center justify-center p-8 overflow-hidden`}
                style={
                  imageUrl
                    ? {
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}
                }
              >
                {/* Overlay for text readability */}
                {imageUrl && (
                  <div className="absolute inset-0 bg-black/40 dark:bg-black/60 rounded-2xl"></div>
                )}
                {/* Background gradient when no image */}
                {!imageUrl && (
                  <div
                    className={`absolute inset-0 ${config.bg} rounded-2xl`}
                  ></div>
                )}

                {/* Audio button - only visible on back side */}
                {audioUrl && (
                  <button
                    type="button"
                    onClick={handleAudioButtonClick}
                    onMouseDown={handleAudioPointerDown}
                    onPointerDown={handleAudioPointerDown}
                    onTouchStart={handleAudioPointerDown}
                    className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-900/80 shadow-lg hover:shadow-xl transition hover:scale-110 active:scale-95 z-30 border border-white/40 backdrop-blur cursor-pointer"
                    title={t("flashcard.playPronunciation")}
                  >
                    <svg
                      className="w-5 h-5 text-purple-600 dark:text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  </button>
                )}

                <div className="text-center w-full relative z-10">
                  <div className="flex items-center justify-center mb-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        imageUrl
                          ? "bg-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                          : config.accentBg
                      } mr-2`}
                    ></div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        imageUrl
                          ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                          : config.accent
                      }`}
                    >
              {t("flashcard.translation")}
                    </p>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        imageUrl
                          ? "bg-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                          : config.accentBg
                      } ml-2`}
                    ></div>
                  </div>
                  {/* Translation display based on format */}
                  {translationData.type === "both" ? (
                    <>
                      <h2
                        className={`text-5xl md:text-6xl font-bold mb-2 leading-tight break-words px-4 ${
                          imageUrl
                            ? "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {translationData.word}
                      </h2>
                      <p
                        className={`text-xl md:text-2xl font-medium mb-4 leading-relaxed ${
                          imageUrl
                            ? "text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {translationData.phrase}
                      </p>
                    </>
                  ) : translationData.type === "phrase" ? (
                    <h2
                      className={`text-3xl md:text-4xl font-bold mb-4 leading-tight break-words px-4 ${
                        imageUrl
                          ? "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {translationData.text}
                    </h2>
                  ) : (
                    <h2
                      className={`text-5xl md:text-6xl font-bold mb-4 leading-tight break-words px-4 ${
                        imageUrl
                          ? "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {translationData.text}
                    </h2>
                  )}
                  {/* Pronunciation and audio button under translation */}
                  <div className="flex items-center justify-center gap-3 mb-4 relative z-20">
                    {pronunciation && (
                      <p
                        className={`text-lg font-medium ${
                          imageUrl
                            ? "text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                            : "text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        {pronunciation}
                      </p>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-4 font-medium ${
                      imageUrl
                        ? "text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
              {t("flashcard.flipBack")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {decision === "know" && (
            <div
              className="pointer-events-none absolute -inset-4 z-40 overflow-hidden rounded-[2rem]"
              aria-hidden="true"
            >
              <span className="study-confetti study-confetti-1" />
              <span className="study-confetti study-confetti-2" />
              <span className="study-confetti study-confetti-3" />
              <span className="study-confetti study-confetti-4" />
              <span className="study-confetti study-confetti-5" />
              <span className="study-confetti study-confetti-6" />
              <span className="study-confetti study-confetti-7" />
              <span className="study-confetti study-confetti-8" />
            </div>
          )}
        </div>
      </div>

      {isStudyMode ? (
        /* DuoCards-style study controls */
        <div className="mt-4 w-full max-w-xl shrink-0">
        <div className="mb-2 flex items-center justify-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <svg
            className="mr-1.5 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {t("flashcard.learned")} {learnedCount}/{totalCount}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              markDontKnow();
            }}
            disabled={decision !== null}
            className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-3 font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 active:scale-95 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 sm:px-5"
          >
            <span className="block text-base">←</span>
            <span className="text-xs sm:text-sm">
              {t("flashcard.dontKnow")}
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleFlip();
            }}
            disabled={decision !== null}
            className="rounded-xl bg-blue-600 px-2 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-95 sm:px-5"
            aria-pressed={isFlipped}
          >
            <span className="block text-base">↻</span>
            <span className="text-xs sm:text-sm">{t("flashcard.flip")}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              markKnow();
            }}
            disabled={decision !== null}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-3 font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 sm:px-5"
          >
            <span className="block text-base">→</span>
            <span className="text-xs sm:text-sm">{t("flashcard.know")}</span>
          </button>
        </div>
        <p className="mt-2 hidden text-center text-[11px] text-gray-400 sm:block dark:text-gray-500">
          {t("flashcard.keyboardHint")}
        </p>
        </div>
      ) : (
        /* Standard navigation used by live-game practice mode */
        <div className="mt-4 flex shrink-0 gap-4">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsFlipped(false);
              onPrevious?.();
            }}
            disabled={!hasPrevious}
            className="rounded-xl bg-gray-200 px-8 py-3 font-semibold text-gray-800 shadow-lg transition-all duration-200 hover:bg-gray-300 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {t("flashcard.previous")}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsFlipped(false);
              onNext?.();
            }}
            disabled={!hasNext}
            className="rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("flashcard.next")}
          </button>
        </div>
      )}
      <style jsx>{`
        @keyframes study-confetti {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(0deg) scale(0.6);
          }
          22% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(
                var(--confetti-x),
                var(--confetti-y),
                0
              )
              rotate(var(--confetti-rotate)) scale(1);
          }
        }

        .study-confetti {
          --confetti-x: 0px;
          --confetti-y: 0px;
          --confetti-rotate: 120deg;
          position: absolute;
          width: 7px;
          height: 11px;
          border-radius: 2px;
          animation: study-confetti 320ms ease-out both;
        }

        .study-confetti-1 {
          --confetti-x: -22px;
          --confetti-y: -24px;
          left: 7%;
          top: 20%;
          background: #34d399;
        }

        .study-confetti-2 {
          --confetti-x: -28px;
          --confetti-y: 20px;
          --confetti-rotate: -150deg;
          left: 4%;
          top: 68%;
          background: #fbbf24;
        }

        .study-confetti-3 {
          --confetti-x: 18px;
          --confetti-y: -28px;
          --confetti-rotate: 190deg;
          right: 7%;
          top: 18%;
          background: #818cf8;
        }

        .study-confetti-4 {
          --confetti-x: 28px;
          --confetti-y: 22px;
          --confetti-rotate: -130deg;
          right: 5%;
          top: 70%;
          background: #fb7185;
        }

        .study-confetti-5 {
          --confetti-x: -12px;
          --confetti-y: -25px;
          --confetti-rotate: 160deg;
          left: 28%;
          top: 4%;
          height: 7px;
          border-radius: 999px;
          background: #60a5fa;
          animation-delay: 25ms;
        }

        .study-confetti-6 {
          --confetti-x: 15px;
          --confetti-y: -24px;
          --confetti-rotate: -180deg;
          right: 27%;
          top: 3%;
          background: #fbbf24;
          animation-delay: 35ms;
        }

        .study-confetti-7 {
          --confetti-x: -10px;
          --confetti-y: 24px;
          left: 30%;
          bottom: 3%;
          background: #a78bfa;
          animation-delay: 20ms;
        }

        .study-confetti-8 {
          --confetti-x: 12px;
          --confetti-y: 26px;
          --confetti-rotate: -160deg;
          right: 29%;
          bottom: 4%;
          height: 7px;
          border-radius: 999px;
          background: #34d399;
          animation-delay: 30ms;
        }

        @media (prefers-reduced-motion: reduce) {
          .study-confetti {
            animation-duration: 1ms;
          }
        }
      `}</style>
    </div>
  );
}
