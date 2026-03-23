"use client";

import {
  useState,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { COIN_COSTS } from "@/lib/coin-costs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCoinsUpdate?: (coins: number) => void;
}

const MAX_PROMPT_LENGTH = 250;

export default function AIChatModal({
  isOpen,
  onClose,
  onCoinsUpdate,
}: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI Duocard helper focused on language learning and vocabulary. I can help you with words, flashcards, translations, pronunciations, study techniques for language learning, and questions about using Duocards. I'm here to help you learn languages - what would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textareaHeight, setTextareaHeight] = useState(38);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when modal opens and reset textarea height
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Reset height when modal opens
      inputRef.current.style.height = "auto";
      setTextareaHeight(38);
      setTimeout(() => {
        inputRef.current?.focus();
        // Recalculate height after focus
        if (inputRef.current) {
          const scrollHeight = inputRef.current.scrollHeight;
          const maxHeight = 150;
          const minHeight = 38;
          const newHeight = Math.max(
            minHeight,
            Math.min(scrollHeight, maxHeight),
          );
          inputRef.current.style.height = `${newHeight}px`;
          setTextareaHeight(newHeight);
        }
      }, 100);
    }
  }, [isOpen]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current && isOpen) {
      // Use double requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            // Reset height to get accurate scrollHeight
            inputRef.current.style.height = "auto";
            // Get the scrollHeight which automatically accounts for all lines
            const scrollHeight = inputRef.current.scrollHeight;
            // Set max height to about 6-7 lines (around 150px) to prevent it from growing too large
            const maxHeight = 150;
            const minHeight = 38;
            // Use scrollHeight directly - it already accounts for line breaks
            const newHeight = Math.max(
              minHeight,
              Math.min(scrollHeight, maxHeight),
            );
            inputRef.current.style.height = `${newHeight}px`;
            setTextareaHeight(newHeight);
          }
        });
      });
    }
  }, [input, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    // Height will be reset automatically by the useEffect when input changes

    // Add user message
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Build conversation history
      const conversationHistory = newMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory.slice(0, -1), // Exclude current message
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      // Add assistant response
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.response },
      ]);

      // Update coins if callback provided
      if (onCoinsUpdate && data.remainingCoins !== undefined) {
        onCoinsUpdate(data.remainingCoins);
      }

      // Dispatch custom event for coin updates (for pages that listen to it)
      if (data.remainingCoins !== undefined) {
        window.dispatchEvent(
          new CustomEvent("coinsUpdated", {
            detail: { coins: data.remainingCoins },
          }),
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      console.error("Error sending message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setInput(nextValue.slice(0, MAX_PROMPT_LENGTH));
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-4 bottom-20 z-50 w-96 max-w-[calc(100vw-2rem)]">
      {/* Chat Widget */}
      <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all flex flex-col max-h-[calc(100vh-7rem)] animate-in slide-in-from-bottom-5 duration-300">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                AI Duocard Helper
              </h3>
              <p className="text-xs text-white/80">Ask me anything</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50 dark:bg-gray-900/50">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === "user"
                    ? "bg-purple-600 text-white dark:bg-purple-500"
                    : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-700 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-600">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={1}
              disabled={isLoading}
              style={{
                minHeight: "38px",
                maxHeight: "150px",
                overflowY: "auto",
              }}
              maxLength={MAX_PROMPT_LENGTH}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center gap-1 self-start"
              style={{ height: `${textareaHeight}px` }}
            >
              {isLoading ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            <p>
              {input.length}/{MAX_PROMPT_LENGTH} characters
            </p>
            <p>max 250</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {COIN_COSTS.AI_CHAT} AI coins per message
          </p>
        </div>
      </div>
    </div>
  );
}
