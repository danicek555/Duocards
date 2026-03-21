/**
 * Local chat content checks — no external AI / moderation API.
 * Uses a dictionary-based profanity filter; extend with addWords() if needed.
 */

import { Filter } from "bad-words";

const filter = new Filter();

/** Extra terms to block (slurs, spam patterns, etc.) — add as needed, lowercase. */
const EXTRA_BLOCKED: string[] = [
  // Add app-specific blocked strings here (lowercase).
];

for (const w of EXTRA_BLOCKED) {
  filter.addWords(w);
}

export function messageContainsBlockedContent(text: string): boolean {
  const t = text?.trim();
  if (!t) return false;
  return filter.isProfane(t);
}

/**
 * Checks the outgoing user message and any prior user turns in history.
 */
export function chatContainsBlockedContent(
  currentMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): boolean {
  if (messageContainsBlockedContent(currentMessage)) return true;
  for (const msg of conversationHistory) {
    if (msg.role === "user" && msg.content && messageContainsBlockedContent(msg.content)) {
      return true;
    }
  }
  return false;
}
