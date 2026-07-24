# Lokalizace

> Stav k 2026-07-24 (v1.0.0): platné — 30 jazyků, fallback angličtina.

## Jak lokalizace funguje

`src/i18n/I18nProvider.tsx` poskytuje:

- `locale` – aktivní jazyk;
- `setLocale()` – změnu jazyka a volitelnou synchronizaci;
- `t(key, params)` – překlad a interpolaci;
- `ready` – stav načtení uloženého locale.

Podporovaná locale jsou definovaná v `src/i18n/types.ts`. Výchozí jazyk je
čeština. Překladové stromy jsou v `src/i18n/locales/` a skládají se v
`src/i18n/translate.ts`. Pokud v aktivním locale klíč chybí, překladač použije
angličtinu; pokud chybí i tam, zobrazí samotný klíč.

## Přidání textu do UI

1. Zvol stabilní významový klíč, například `createSet.publicHint`.
2. Přidej anglickou hodnotu do `src/i18n/locales/en.ts`.
3. Přidej českou hodnotu do `src/i18n/locales/cs.ts`.
4. Podle rozsahu doplň ostatní locale; jinak vědomě využij anglický fallback.
5. V klientské komponentě použij:

```tsx
const { t } = useI18n();

<button aria-label={t("common.close")}>{t("common.close")}</button>
```

6. Pro proměnné používej interpolaci:

```ts
t("dashboard.setsCount", { count: flashcardSets.length });
```

Neskládej věty z několika přeložených fragmentů. Slovosled a skloňování se
mezi jazyky liší; raději přelož celou větu jako jeden klíč.

## Co se překládá

- navigace, nadpisy, popisy a tlačítka;
- labely, placeholdery, tooltipy a `aria-label`;
- loading, empty, success a error stavy;
- potvrzovací dialogy;
- názvy systémových režimů a funkcí;
- počty, jednotky a cenové řádky;
- názvy podporovaných jazyků pomocí `getLanguageLabel()`.

## Co se nepřekládá

- názvy balíčků vytvořené uživatelem;
- vlastní tagy;
- slova a překlady uvnitř kartiček;
- přezdívky a chatové zprávy;
- veřejné a pokojové kódy;
- značky jako DuoCards, Google a Facebook;
- technická ID, URL a názvy proměnných.

Systémový tag `AI Generated` je uložená technická hodnota, ale při zobrazení se
lokalizuje přes `dashboard.aiGenerated`.

## Jazyky kartiček versus jazyk aplikace

Jazyk aplikace (`locale`) určuje UI. `fromLanguage` a `toLanguage` jsou doménové
hodnoty uložené anglickými identifikátory, například `English` nebo `Spanish`.
Neměň uloženou hodnotu; pro zobrazení použij:

```ts
getLanguageLabel(languageValue, locale)
```

Tím zůstanou API a databáze stabilní a uživatel uvidí lokalizovaný název.

## Chyby API

Preferuj stabilní serverový error code a klientský překlad:

```ts
const parsed = parseApiError(payload, t("errors.UNKNOWN_ERROR"));
const message = translateApiError(locale, parsed.code, parsed.message);
```

Text ze serveru může být fallback, ale nemá být jediným zdrojem lokalizace.
Neočekávané chyby nesmí odhalovat interní implementaci.

## Datumy, čísla a množné číslo

- datum formátuj s aktivním locale, ne implicitně podle stroje;
- pro počty používej celý překladový řetězec, ne anglické přidávání `s`;
- u češtiny formuluj text tak, aby bezpečně fungoval pro různé počty, nebo
  přidej samostatné varianty, pokud je přesné skloňování důležité;
- ceny AI funkcí čti z `src/lib/coin-costs.ts`, ne zkopírovanou konstantou.

## RTL

Arabština a hebrejština jsou RTL locale. `isRtlLocale()` určuje směr dokumentu.
Nové layouty proto nemají spoléhat pouze na fyzické `left/right`, pokud lze
použít logické zarovnání nebo flex/grid pořadí.

## Kontrolní seznam lokalizace

- nejsou v TSX nové viditelné anglické literály;
- klíč existuje minimálně v `en.ts` a `cs.ts`;
- interpolační parametry mají v obou variantách stejná jména;
- dlouhý překlad nerozbíjí layout;
- ikonové akce mají lokalizovaný přístupný název;
- uživatelský obsah zůstává beze změny;
- česká a anglická varianta byly ručně zkontrolované.
