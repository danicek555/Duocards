"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface MoneyBagRewardProps {
  rewardAmount: number;
  onClaim: () => Promise<void>;
  isLastCard: boolean;
  isAlreadyClaimed?: boolean;
}

const BURST_COINS = [
  { x: "-112px", y: "-78px", delay: "0ms", rotate: "-52deg" },
  { x: "-62px", y: "-116px", delay: "45ms", rotate: "34deg" },
  { x: "0px", y: "-132px", delay: "20ms", rotate: "88deg" },
  { x: "68px", y: "-112px", delay: "70ms", rotate: "-74deg" },
  { x: "116px", y: "-68px", delay: "25ms", rotate: "48deg" },
  { x: "128px", y: "18px", delay: "90ms", rotate: "110deg" },
  { x: "82px", y: "88px", delay: "40ms", rotate: "-96deg" },
  { x: "14px", y: "112px", delay: "85ms", rotate: "62deg" },
  { x: "-72px", y: "94px", delay: "30ms", rotate: "-38deg" },
  { x: "-124px", y: "28px", delay: "65ms", rotate: "92deg" },
];

function CoinIcon({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const gradientId = useId();

  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" fill={`url(#${gradientId})`} />
      <circle cx="24" cy="24" r="17" stroke="#FFF3B0" strokeWidth="2" />
      <path
        d="M27.4 14.5h-5.2l-6 19h4.8l1-3.8h5.7l1.1 3.8h5l-7.4-19Zm-4.3 11.3 1.6-6.2 1.8 6.2h-3.4Z"
        fill="#7C3AED"
      />
      <defs>
        <linearGradient id={gradientId} x1="10" y1="7" x2="39" y2="42">
          <stop stopColor="#FDE68A" />
          <stop offset="0.48" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function MoneyBagReward({
  rewardAmount,
  onClaim,
  isLastCard,
  isAlreadyClaimed = false,
}: MoneyBagRewardProps) {
  const { t } = useI18n();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimed, setIsClaimed] = useState(isAlreadyClaimed);
  const [claimedThisSession, setClaimedThisSession] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsClaimed(isAlreadyClaimed);
  }, [isAlreadyClaimed]);

  useEffect(
    () => () => {
      if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
    },
    [],
  );

  if (!isLastCard) return null;

  const handleClaim = async () => {
    if (isClaiming || isClaimed) return;

    setIsClaiming(true);
    try {
      await onClaim();
      setIsClaimed(true);
      setClaimedThisSession(true);
      setShowCelebration(true);
      celebrationTimeout.current = setTimeout(() => {
        setShowCelebration(false);
      }, 1500);
    } catch (error) {
      console.error("Error claiming reward:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div
      className={`reward-card-enter relative overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-500 sm:p-5 ${
        isClaimed
          ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-violet-50 dark:border-amber-800/80 dark:from-amber-950/30 dark:via-gray-900 dark:to-violet-950/30"
      }`}
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-36 w-36 rounded-full bg-violet-400/15 blur-3xl" />

      <div className="relative flex items-center gap-4">
        <div
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg sm:h-[4.5rem] sm:w-[4.5rem] ${
            isClaimed
              ? "bg-emerald-100 shadow-emerald-200/60 dark:bg-emerald-900/50 dark:shadow-none"
              : "reward-coin-float bg-gradient-to-br from-amber-100 to-amber-300 shadow-amber-200/80 dark:from-amber-900/70 dark:to-amber-700/70 dark:shadow-none"
          }`}
        >
          {isClaimed && !showCelebration ? (
            <svg
              className="h-9 w-9 text-emerald-600 dark:text-emerald-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                d="m5 12 4 4L19 6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <CoinIcon className="h-12 w-12 drop-shadow-md sm:h-14 sm:w-14" />
          )}
          {!isClaimed && (
            <span className="reward-shine pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`mb-1 text-xs font-bold uppercase tracking-[0.18em] ${
              isClaimed
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {isClaimed ? t("rewards.claimedTitle") : t("rewards.readyTitle")}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-gray-900 dark:text-white sm:text-4xl">
              +{rewardAmount}
            </span>
            <span className="text-sm font-bold text-violet-700 dark:text-violet-300">
              {t("coins.coins")}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {isClaimed
              ? claimedThisSession
                ? t("rewards.claimedHint", { count: rewardAmount })
                : t("rewards.alreadyClaimedHint")
              : t("rewards.readyHint")}
          </p>
        </div>
      </div>

      {!isClaimed && (
        <button
          type="button"
          onClick={handleClaim}
          disabled={isClaiming}
          aria-busy={isClaiming}
          className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/25 active:translate-y-0 active:scale-[0.99] disabled:cursor-wait disabled:opacity-75 motion-reduce:transform-none"
        >
          <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/20 transition-transform duration-700 group-hover:translate-x-[420%] motion-reduce:hidden" />
          {isClaiming ? (
            <>
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              {t("rewards.claiming")}
            </>
          ) : (
            <>
              <CoinIcon className="h-6 w-6" />
              {t("rewards.claimWithAmount", { count: rewardAmount })}
            </>
          )}
        </button>
      )}

      {showCelebration && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-2xl"
          aria-live="polite"
        >
          <div className="absolute inset-0 bg-white/65 backdrop-blur-[2px] dark:bg-gray-950/65" />
          {BURST_COINS.map((coin, index) => (
            <CoinIcon
              key={index}
              className="reward-burst-coin absolute h-7 w-7 drop-shadow-lg"
              style={
                {
                  "--coin-x": coin.x,
                  "--coin-y": coin.y,
                  "--coin-delay": coin.delay,
                  "--coin-rotate": coin.rotate,
                } as CSSProperties
              }
            />
          ))}
          <div className="reward-success-pop relative z-10 text-center">
            <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-xl shadow-amber-500/30">
              <CoinIcon className="h-11 w-11" />
            </div>
            <p className="text-3xl font-black text-gray-900 drop-shadow-sm dark:text-white">
              +{rewardAmount}
            </p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
              {t("rewards.added")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
