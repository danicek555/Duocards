"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Flashcard from "@/components/Flashcard";

interface User {
  id: number;
  email: string;
  nickname: string;
  createdAt: string;
}

interface Word {
  id: number;
  word: string;
  translation: string;
  difficulty: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user data exists in localStorage (from login)
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      // If no user data, redirect to home page
      router.push("/");
      return;
    }
    fetchWords();
  }, [router]);

  const fetchWords = async () => {
    try {
      const response = await fetch("/api/words");
      if (response.ok) {
        const data = await response.json();
        setWords(data.words || []);
        // If no words, create some sample words for demo
        if (data.words.length === 0) {
          await createSampleWords();
        }
      }
    } catch (error) {
      console.error("Error fetching words:", error);
      // Try to create sample words on error
      await createSampleWords();
    } finally {
      setLoading(false);
    }
  };

  const createSampleWords = async () => {
    const sampleWords = [
      { word: "Hello", translation: "Hola", difficulty: 1 },
      { word: "Goodbye", translation: "Adiós", difficulty: 1 },
      { word: "Thank you", translation: "Gracias", difficulty: 1 },
      { word: "Please", translation: "Por favor", difficulty: 1 },
      { word: "Yes", translation: "Sí", difficulty: 1 },
    ];

    try {
      const createdWords: Word[] = [];
      for (const sample of sampleWords) {
        const response = await fetch("/api/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sample),
        });
        if (response.ok) {
          const data = await response.json();
          createdWords.push(data.word);
        }
      }
      setWords(createdWords);
    } catch (error) {
      console.error("Error creating sample words:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const currentWord = words[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            DuoCards
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Welcome back, {user.nickname}!
          </p>
        </div>

        {/* Stats Section */}
        <div className="p-6 space-y-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Words
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              {words.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Current Card
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              {words.length > 0 ? `${currentIndex + 1} / ${words.length}` : "0 / 0"}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 p-6">
          <nav className="space-y-2">
            <button className="w-full text-left px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg font-medium transition-colors">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                Flashcards
              </div>
            </button>
            <button className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add Words
              </div>
            </button>
            <button className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Statistics
              </div>
            </button>
          </nav>
        </div>

        {/* Logout Button */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
          >
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        {words.length > 0 && currentWord ? (
          <Flashcard
            word={currentWord.word}
            translation={currentWord.translation}
            difficulty={currentWord.difficulty}
            onNext={handleNext}
            onPrevious={handlePrevious}
            hasNext={currentIndex < words.length - 1}
            hasPrevious={currentIndex > 0}
          />
        ) : (
          <div className="text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              No flashcards yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Add some words to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
