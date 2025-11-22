"use client";

import { useState, useEffect } from "react";

interface DailyRewardButtonProps {
  onCoinsUpdate?: () => void;
}

export default function DailyRewardButton({ onCoinsUpdate }: DailyRewardButtonProps) {
  const [canClaim, setCanClaim] = useState(false);
  const [timeUntilNextReward, setTimeUntilNextReward] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchRewardStatus = async () => {
    try {
      const response = await fetch("/api/user/daily-reward");
      if (response.ok) {
        const data = await response.json();
        setCanClaim(data.canClaim);
        setTimeUntilNextReward(data.timeUntilNextReward || 0);
      }
    } catch (error) {
      console.error("Error fetching reward status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewardStatus();
    
    // Update timer every second
    const interval = setInterval(() => {
      setTimeUntilNextReward((prev) => {
        if (prev > 0) {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setCanClaim(true);
            return 0;
          }
          return newTime;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClaim = async () => {
    if (!canClaim || claiming) return;

    setClaiming(true);
    try {
      const response = await fetch("/api/user/daily-reward", {
        method: "POST",
      });

      if (response.ok) {
        // Refetch status to get accurate time until next reward
        await fetchRewardStatus();
        if (onCoinsUpdate) {
          onCoinsUpdate();
        }
      } else {
        const errorData = await response.json();
        if (errorData.timeUntilNextReward !== undefined) {
          setTimeUntilNextReward(errorData.timeUntilNextReward);
          setCanClaim(false);
        }
        console.error("Failed to claim reward:", errorData.error);
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
    } finally {
      setClaiming(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-lg py-3 px-4 animate-pulse">
        <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!canClaim && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
          More coins in
        </p>
      )}
      <button
        onClick={handleClaim}
        disabled={!canClaim || claiming}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center ${
          canClaim
            ? "bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
            : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        }`}
      >
        {canClaim ? (
          <>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {claiming ? "Claiming..." : "100 Coins"}
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {formatTime(timeUntilNextReward)}
          </>
        )}
      </button>
    </div>
  );
}

