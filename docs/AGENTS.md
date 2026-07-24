# DuoCards – pravidla pro vývojové agenty

> Stav k 2026-07-24 (v1.0.0).

Tento soubor je závazný pro celý repozitář. Před změnou kódu si přečti také
dokument odpovídající úkolu:

- architektura a datové toky: `ARCHITECTURE.md`;
- lokální vývoj, kontroly a bezpečnost: `DEVELOPMENT.md`;
- UI, interakce a přístupnost: `DESIGN_SYSTEM.md`;
- překlady a jazyky: `LOCALIZATION.md`;
- produktový plán živé hry: `LIVE_GAME_PRODUCT_PLAN.md`.

## Nejdůležitější pravidla

1. Zachovej existující architekturu Next.js webu, sdíleného Fastify backendu a
   vestavěných `/api` fallback rout. Nepřesouvej endpoint mezi vrstvami bez
   výslovného požadavku.
2. Viditelné texty nesmí být v komponentách zapsané natvrdo. Používej
   `useI18n()` a klíče v `src/i18n/locales/`. Nový klíč musí mít minimálně
   anglickou a českou variantu; ostatní jazyky mohou dočasně použít anglický
   fallback.
3. Uživatelský obsah se nepřekládá ani nepřejmenovává. Platí to hlavně pro
   názvy balíčků, tagy, slova, překlady, přezdívky a zprávy v chatu.
4. Každý skutečně klikací prvek musí mít srozumitelný hover/focus stav a
   ručičku. Neinteraktivní prvky ručičku mít nesmí. Vypnuté akce používají
   `cursor-not-allowed`.
5. Ikonové tlačítko musí mít lokalizovaný `aria-label` nebo `title`. Input musí
   mít label nebo odpovídající přístupný název.
6. Dropdowny, popupy a menu musí zůstat nad sousedními kartami. Při opravě
   nepoužívej zbytečně globálně vysoký `z-index`; zvyš vrstvu aktivního
   kontejneru nebo použij vhodný portal.
7. Respektuj světlý i tmavý režim a existující Tailwind vizuální jazyk. Novou
   paralelní sadu barev, radiusů nebo stínů zaváděj jen záměrně.
8. Neprováděj destruktivní databázové operace. `npm run build` spouští
   `prisma migrate deploy`, takže ho nepoužívej jako běžnou lokální kontrolu.
9. Zachovej cizí rozpracované změny. Neupravuj nesouvisející soubory a
   nemaž neznámé nebo nesledované soubory.
10. Po změně spusť kontroly úměrné riziku. Pro běžný webový zásah minimálně
    `npx tsc --noEmit`, `npm run lint -- --quiet` a `git diff --check`.

## Standardní postup

1. Najdi vlastníka daného chování a související překladové klíče.
2. Ověř, zda tok používá `apiFetch` (migrované API), nebo přímé `/api` routy.
3. Udělej nejmenší soudržnou změnu bez duplikování logiky.
4. Zkontroluj českou i anglickou variantu, loading/empty/error/disabled stavy,
   tmavý režim a dlouhé texty nebo přezdívky.
5. Spusť relevantní statické kontroly a testy.
6. V předání popiš výsledek, ověření a případná známá omezení.

## Definice hotové UI změny

- funguje pro myš i klávesnici;
- text se řídí aktivním jazykem;
- dlouhé názvy se bezpečně zalomí nebo zkrátí pouze tam, kde je to zamýšlené;
- loading, prázdný, chybový a zakázaný stav jsou použitelné;
- žádný popup není zakrytý sousedním obsahem;
- nedošlo k regresi ve světlém ani tmavém režimu;
- TypeScript a lint nemají nové chyby.
