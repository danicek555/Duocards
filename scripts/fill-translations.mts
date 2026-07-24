/**
 * Fills every locale with the keys it is missing relative to English.
 *
 * English (`en`) is the complete reference. Each target locale is compared to
 * it; any key present in `en` but missing in the locale is translated via the
 * OpenAI API (the same account the app uses) and written back. Keys the locale
 * already has are never touched, so the script is safe to re-run and only ever
 * generates what is genuinely missing.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/fill-translations.mts
 *   # optional: only some locales
 *   OPENAI_API_KEY=sk-... npx tsx scripts/fill-translations.mts de fr ja
 *
 * Notes:
 *   - Placeholders like {count} are preserved verbatim by the prompt.
 *   - Runs in batches per locale to keep requests small and cheap.
 *   - Requires Node >= 22.12 (see package.json engines).
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import OpenAI from "openai";
import { en } from "../src/i18n/locales/en";
import { LOCALES, LOCALE_LABELS, type Locale } from "../src/i18n/types";

const MODEL = "gpt-4o-mini";
const BATCH_SIZE = 60;
const LOCALES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "i18n",
  "locales",
);

// en is the reference and cs is already complete; everything else is a target.
const SKIP: Locale[] = ["en", "cs"];

type Tree = Record<string, unknown>;

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Tree, path));
    }
  }
  return out;
}

function setDeep(tree: Tree, dottedKey: string, value: string): void {
  const parts = dottedKey.split(".");
  let node = tree;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!node[part] || typeof node[part] !== "object") node[part] = {};
    node = node[part] as Tree;
  }
  node[parts[parts.length - 1]] = value;
}

async function loadLocale(code: Locale): Promise<Tree> {
  const mod = (await import(`../src/i18n/locales/${code}`)) as Record<
    string,
    unknown
  >;
  return (mod[code] ?? {}) as Tree;
}

async function translateBatch(
  client: OpenAI,
  languageName: string,
  entries: Record<string, string>,
): Promise<Record<string, string>> {
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `You are a professional UI localizer for a language-learning app. ` +
          `Translate the VALUES of the given JSON object into ${languageName}. ` +
          `Rules: keep the keys unchanged; translate values naturally and concisely for UI; ` +
          `keep placeholders like {count}, {total}, {name} EXACTLY as-is; ` +
          `keep the brand name "DuoCards" unchanged; do not add or remove keys; ` +
          `return ONLY a JSON object mapping the same keys to the translated strings.`,
      },
      { role: "user", content: JSON.stringify(entries) },
    ],
  });
  const content = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as Record<string, string>;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required.");
    process.exit(1);
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const flatEn = flatten(en as unknown as Tree);

  const requested = process.argv.slice(2) as Locale[];
  const targets = (requested.length ? requested : LOCALES).filter(
    (code) => !SKIP.includes(code),
  );

  for (const code of targets) {
    const tree = await loadLocale(code);
    const flatTarget = flatten(tree);
    const missing = Object.entries(flatEn).filter(
      ([key]) => !(key in flatTarget),
    );
    if (missing.length === 0) {
      console.log(`${code}: complete, nothing to do`);
      continue;
    }
    const languageName = LOCALE_LABELS[code] ?? code;
    console.log(`${code} (${languageName}): ${missing.length} missing keys`);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = Object.fromEntries(missing.slice(i, i + BATCH_SIZE));
      const translated = await translateBatch(client, languageName, batch);
      for (const [key, value] of Object.entries(translated)) {
        if (typeof value === "string") setDeep(tree, key, value);
      }
      console.log(
        `  ${code}: ${Math.min(i + BATCH_SIZE, missing.length)}/${missing.length}`,
      );
    }

    const file = path.join(LOCALES_DIR, `${code}.ts`);
    const body = `export const ${code} = ${JSON.stringify(tree, null, 2)} as const;\n`;
    await writeFile(file, body, "utf8");
    console.log(`  ${code}: written`);
  }

  console.log("Done. Review the diff, then run: npx tsc --noEmit");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
