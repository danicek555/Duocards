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

const CZECH_LANGUAGE_LABELS: Record<string, string> = {
  Arabic: "Arabština", Catalan: "Katalánština", Chinese: "Čínština (mandarínština)",
  Czech: "Čeština", Danish: "Dánština", Dutch: "Nizozemština", English: "Angličtina",
  Finnish: "Finština", French: "Francouzština", German: "Němčina", Greek: "Řečtina",
  Hebrew: "Hebrejština", Hindi: "Hindština", Hungarian: "Maďarština", Indonesian: "Indonéština",
  Italian: "Italština", Japanese: "Japonština", Korean: "Korejština", Norwegian: "Norština",
  Polish: "Polština", Portuguese: "Portugalština", Romanian: "Rumunština", Russian: "Ruština",
  Spanish: "Španělština", Swedish: "Švédština", Thai: "Thajština", Turkish: "Turečtina",
  Ukrainian: "Ukrajinština", Vietnamese: "Vietnamština",
};

export function getLanguageLabel(value: string, locale: string) {
  if (locale === "cs") return CZECH_LANGUAGE_LABELS[value] ?? value;
  return LANGUAGES.find((language) => language.value === value)?.label ?? value;
}
