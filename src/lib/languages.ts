/**
 * Supported languages for flashcards
 * This is a shared constant used across all components
 */

export const LANGUAGES = [
  { value: "Arabic", label: "Arabic" },
  { value: "Catalan", label: "Catalan" },
  { value: "Chinese", label: "Chinese (Mandarin)" },
  { value: "Czech", label: "Czech" },
  { value: "Danish", label: "Danish" },
  { value: "Dutch", label: "Dutch" },
  { value: "English", label: "English" },
  { value: "Finnish", label: "Finnish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Greek", label: "Greek" },
  { value: "Hebrew", label: "Hebrew" },
  { value: "Hindi", label: "Hindi" },
  { value: "Hungarian", label: "Hungarian" },
  { value: "Indonesian", label: "Indonesian" },
  { value: "Italian", label: "Italian" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
  { value: "Norwegian", label: "Norwegian" },
  { value: "Polish", label: "Polish" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Romanian", label: "Romanian" },
  { value: "Russian", label: "Russian" },
  { value: "Spanish", label: "Spanish" },
  { value: "Swedish", label: "Swedish" },
  { value: "Thai", label: "Thai" },
  { value: "Turkish", label: "Turkish" },
  { value: "Ukrainian", label: "Ukrainian" },
  { value: "Vietnamese", label: "Vietnamese" },
];

const LANGUAGE_CODES: Record<string, string> = {
  Arabic: "ar",
  Catalan: "ca",
  Chinese: "zh",
  Czech: "cs",
  Danish: "da",
  Dutch: "nl",
  English: "en",
  Finnish: "fi",
  French: "fr",
  German: "de",
  Greek: "el",
  Hebrew: "he",
  Hindi: "hi",
  Hungarian: "hu",
  Indonesian: "id",
  Italian: "it",
  Japanese: "ja",
  Korean: "ko",
  Norwegian: "no",
  Polish: "pl",
  Portuguese: "pt",
  Romanian: "ro",
  Russian: "ru",
  Spanish: "es",
  Swedish: "sv",
  Thai: "th",
  Turkish: "tr",
  Ukrainian: "uk",
  Vietnamese: "vi",
};

const displayNamesCache = new Map<string, Intl.DisplayNames>();

export function getLanguageLabel(value: string, locale: string) {
  const languageCode = LANGUAGE_CODES[value];
  if (!languageCode || typeof Intl.DisplayNames !== "function") {
    return LANGUAGES.find((language) => language.value === value)?.label ?? value;
  }

  try {
    let displayNames = displayNamesCache.get(locale);
    if (!displayNames) {
      displayNames = new Intl.DisplayNames([locale], { type: "language" });
      displayNamesCache.set(locale, displayNames);
    }
    return displayNames.of(languageCode) ?? value;
  } catch {
    return LANGUAGES.find((language) => language.value === value)?.label ?? value;
  }
}
