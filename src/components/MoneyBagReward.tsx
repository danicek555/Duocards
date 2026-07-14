"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface MoneyBagRewardProps {
  rewardAmount: number;
  onClaim: () => Promise<void>;
  isLastCard: boolean;
  isAlreadyClaimed?: boolean;
}

type Position = {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "center" | "bottom";
  offsetX: number;
  offsetY: number;
};

export default function MoneyBagReward({
  rewardAmount,
  onClaim,
  isLastCard,
  isAlreadyClaimed = false,
}: MoneyBagRewardProps) {
  const { t } = useI18n();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimed, setIsClaimed] = useState(isAlreadyClaimed);
  const [showAnimation, setShowAnimation] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  // Generate random position when component mounts or when isLastCard becomes true
  // Only positions that are clearly outside the flashcard area (corners and far edges)
  useEffect(() => {
    if (isLastCard && !isClaimed) {
      const positions: Position[] = [
        // Top corners
        { horizontal: "left", vertical: "top", offsetX: 4, offsetY: 4 },
        { horizontal: "right", vertical: "top", offsetX: 4, offsetY: 4 },
        // Bottom corners
        { horizontal: "left", vertical: "bottom", offsetX: 4, offsetY: 4 },
        { horizontal: "right", vertical: "bottom", offsetX: 4, offsetY: 4 },
        // Far left edge (top and bottom)
        { horizontal: "left", vertical: "top", offsetX: 4, offsetY: 120 },
        { horizontal: "left", vertical: "bottom", offsetX: 4, offsetY: 120 },
        // Far right edge (top and bottom)
        { horizontal: "right", vertical: "top", offsetX: 4, offsetY: 120 },
        { horizontal: "right", vertical: "bottom", offsetX: 4, offsetY: 120 },
      ];

      const randomPosition =
        positions[Math.floor(Math.random() * positions.length)];
      setPosition(randomPosition);
    }
  }, [isLastCard, isClaimed]);

  if (!isLastCard || !position) return null;

  const handleClaim = async () => {
    if (isClaiming || isClaimed) return;

    setIsClaiming(true);
    try {
      await onClaim();
      setIsClaimed(true);
      setShowAnimation(true);
      // Hide animation after 2 seconds
      setTimeout(() => {
        setShowAnimation(false);
      }, 2000);
    } catch (error) {
      console.error("Error claiming reward:", error);
      // Error is handled by the parent component (dashboard) via notification
    } finally {
      setIsClaiming(false);
    }
  };

  // Generate positioning classes based on random position
  // All positions are corners or edges, never center
  const getPositionClasses = () => {
    const classes: string[] = [];

    if (position.horizontal === "left") {
      classes.push("left-4");
    } else if (position.horizontal === "right") {
      classes.push("right-4");
    }

    if (position.vertical === "top") {
      // Use offsetY to position at different distances from top
      if (position.offsetY <= 20) {
        classes.push("top-4");
      } else {
        classes.push("top-32");
      }
    } else if (position.vertical === "bottom") {
      // Use offsetY to position at different distances from bottom
      if (position.offsetY <= 20) {
        classes.push("bottom-4");
      } else {
        classes.push("bottom-32");
      }
    }

    return classes.join(" ");
  };

  return (
    <div className={`absolute ${getPositionClasses()} z-10`}>
      {/* Money Bag Button */}
      <button
        onClick={handleClaim}
        disabled={isClaiming || isClaimed}
        className={`relative group transition-all duration-300 ${
          isClaimed
            ? "opacity-60 cursor-default"
            : "hover:scale-110 active:scale-95 cursor-pointer"
        } ${isClaiming ? "animate-pulse" : ""}`}
      >
        {/* Money Bag SVG */}
        <div className="relative">
          <svg
            className={`text-yellow-500 dark:text-yellow-400 drop-shadow-lg transition-all duration-300 ${
              isClaimed
                ? "w-12 h-12 md:w-14 md:h-14"
                : "w-20 h-20 md:w-24 md:h-24"
            }`}
            fill="currentColor"
            viewBox="0 0 512 512"
          >
            <path d="M306.34,343.86c0,19.95-13.05,33.74-36.17,38v8c0,5.22-1.68,6.9-6.9,6.9H249.11c-5,0-6.9-1.68-6.9-6.9v-7.64c-18.27-2.8-30.2-11.93-36-27.22q-2.52-7.27,5-10.06l12.68-4.48c5.41-2,8-.93,10.44,4.48,3,7.64,9.88,11.37,20.51,11.37,14.17,0,21.25-3.92,21.25-11.94,0-7.45-7.27-9.88-22-11.37-10.44-1.31-15.85-1.87-25.36-5.59a32.36,32.36,0,0,1-11.55-6.53c-5.78-5-10.63-14.54-10.63-26.65,0-19.58,12.49-33,35.61-36.72v-7.65c0-5,1.86-6.71,6.9-6.71h14.17c5.22,0,6.9,1.68,6.9,6.71v7.65c15.1,2.61,25.73,10.62,32.06,24.23,2.8,5.22,1.49,8-4.29,10.44L285.09,298c-5,2.24-7.46,1.49-10.26-3.73-3.73-7.27-8.57-10.81-18.82-10.81-13.23,0-18.83,2.8-18.83,10.81,0,6.9,7.83,9.51,22.18,11a130,130,0,0,1,21.25,3.54,36.42,36.42,0,0,1,10.07,4.29C299.07,318.14,307.09,327.83,306.34,343.86ZM256,512c-324.62,0-150.83-289-99.09-365.56a38.35,38.35,0,0,1,.39-62.75L145,58.64A40.77,40.77,0,0,1,147,19,39.72,39.72,0,0,1,180.64,0a50.09,50.09,0,0,1,37.72,17.09,50,50,0,0,1,75.28,0A50,50,0,0,1,331.28,0,39.75,39.75,0,0,1,365,19a40.77,40.77,0,0,1,2,39.64l-12.28,25a38.35,38.35,0,0,1,.39,62.75C406.83,223,580.62,512,256,512ZM166.4,115.2A12.81,12.81,0,0,0,179.2,128H332.8a12.8,12.8,0,0,0,0-25.6H179.2A12.81,12.81,0,0,0,166.4,115.2ZM168,47.38,182.42,76.8H329.58L344,47.38a15.32,15.32,0,0,0-.73-14.9,14.09,14.09,0,0,0-12.06-6.88,24.79,24.79,0,0,0-22.8,15.59,15.92,15.92,0,0,1-29.54,0,24.58,24.58,0,0,0-45.75,0,15.92,15.92,0,0,1-29.53,0A24.82,24.82,0,0,0,180.72,25.6a14.06,14.06,0,0,0-12,6.88A15.32,15.32,0,0,0,168,47.38ZM329.1,153.6H182.92C141.08,213,61.87,351.95,99.39,426.92,119.15,466.39,171.84,486.4,256,486.4s136.88-20,156.62-59.51C450.19,351.75,371,212.91,329.1,153.6Z" />
          </svg>

          {/* Shine effect */}
          {!isClaimed && (
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/50 to-transparent rounded-full blur-sm animate-pulse" />
          )}

          {/* Reward amount badge */}
          <div
            className={`absolute -top-2 -right-2 bg-purple-600 dark:bg-purple-500 text-white font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 transition-all duration-300 ${
              isClaimed ? "w-5 h-5 text-[10px]" : "w-8 h-8 text-xs"
            }`}
          >
            {rewardAmount}
          </div>
        </div>

        {/* Tooltip text */}
        {!isClaimed && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded shadow-lg">
              {t("rewards.clickClaim", { count: rewardAmount })}
            </div>
          </div>
        )}
      </button>

      {/* Success animation */}
      {showAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="animate-bounce text-4xl font-bold text-yellow-400 drop-shadow-lg">
            {t("rewards.claimedAnimation", { count: rewardAmount })}
          </div>
        </div>
      )}

      {/* Claimed state */}
      {isClaimed && !showAnimation && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 whitespace-nowrap">
          <span>{t("rewards.claimed", { count: rewardAmount })}</span>
          <span>✓</span>
        </div>
      )}
    </div>
  );
}
