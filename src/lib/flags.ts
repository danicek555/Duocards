/**
 * Language to Flag Emoji Mapping
 * Maps language names to their corresponding flag emojis
 */

export const LANGUAGE_FLAGS: Record<string, string> = {
  English: "🇬🇧",
  Spanish: "🇪🇸",
  French: "🇫🇷",
  German: "🇩🇪",
  Italian: "🇮🇹",
  Portuguese: "🇵🇹",
  Japanese: "🇯🇵",
  Chinese: "🇨🇳",
  Korean: "🇰🇷",
  Russian: "🇷🇺",
  Arabic: "🇸🇦",
  Dutch: "🇳🇱",
  Swedish: "🇸🇪",
  Norwegian: "🇳🇴",
  Polish: "🇵🇱",
  Turkish: "🇹🇷",
  Hindi: "🇮🇳",
  Vietnamese: "🇻🇳",
  Thai: "🇹🇭",
  Indonesian: "🇮🇩",
  Greek: "🇬🇷",
  Hebrew: "🇮🇱",
  Czech: "🇨🇿",
  Romanian: "🇷🇴",
  Finnish: "🇫🇮",
  Danish: "🇩🇰",
  Hungarian: "🇭🇺",
  Ukrainian: "🇺🇦",
  Catalan: "🇪🇸",
};

/**
 * Get flag emoji for a language
 * @param language - The language name (e.g., "English", "Spanish")
 * @returns Flag emoji or "🌐" as default
 */
export function getLanguageFlag(language: string | null | undefined): string {
  if (!language) return "🌐";
  return LANGUAGE_FLAGS[language] || "🌐";
}
