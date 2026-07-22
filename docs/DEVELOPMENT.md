# Vývoj a ověřování

## Požadavky

- Node.js kompatibilní s Next.js projektem; backend deklaruje Node
  `^20.19 || ^22.12 || >=24`;
- npm;
- PostgreSQL databáze pro plné integrační toky;
- vyplněné lokální `.env` soubory podle README a `backend/.env.example`.

Tajné hodnoty nikdy nevkládej do zdrojových souborů, dokumentace, logů ani
commitů. Do klientských proměnných patří pouze hodnoty s bezpečným
`NEXT_PUBLIC_` obsahem.

## Lokální spuštění

Web:

```sh
npm install
npm run dev:web
```

Výchozí URL je `http://localhost:3000`. Pokud je port obsazený, Next.js zvolí
další volný port; při předání vždy uveď skutečnou URL z výstupu serveru.

Backend:

```sh
npm install --prefix backend
npm --prefix backend run prisma:generate
npm run dev:backend
```

Výchozí backend je `http://localhost:4000`. Pro propojení webu nastav:

```dotenv
SHARED_BACKEND_URL=http://127.0.0.1:4000
NEXT_PUBLIC_SHARED_API_BASE_URL=/shared-api
```

## Doporučené kontroly

### Běžná webová změna

```sh
npx tsc --noEmit
npm run lint -- --quiet
npm run test:coins
git diff --check
```

### Backendová změna

```sh
npm --prefix backend run typecheck
npm run test:backend
npm run build:backend
```

### Databázová změna

```sh
npx prisma validate
npm --prefix backend run prisma:validate
```

Potom ověř soulad obou Prisma schémat a migrací. Migraci nevytvářej ani
nenasazuj proti sdílené databázi bez jasného zadání a kontroly prostředí.

## Důležité upozornění k buildu

Kořenové skripty `build`, `build:prod` a `build:vercel` před Next.js buildem
spouštějí `prisma migrate deploy`. Nejsou tedy bezpečnou náhradou za běžný
lokální typecheck. Použij je pouze tehdy, když je databázové prostředí správně
nastavené a nasazení migrací je záměrné.

## Ruční kontrola webu

Podle změny zkontroluj:

1. české a anglické locale;
2. světlý a tmavý režim;
3. loading, empty, error a disabled stav;
4. dlouhou přezdívku, název balíčku a tag;
5. ovládání myší a klávesnicí;
6. popupy u první, prostřední i poslední karty v gridu;
7. formulář vytvoření, AI vytvoření a editace stejné entity;
8. konzoli prohlížeče a síťové chyby.

## Bezpečné změny API

- zachovej `credentials: "include"` u session požadavků;
- validuj vstup na serveru, ne pouze v UI;
- autorizaci kontroluj vůči přihlášenému uživateli a vlastnictví entity;
- veřejnému klientovi nevracej interní stack trace ani tajné konfigurace;
- pro očekávané chyby používej stabilní error code, který lze přeložit;
- neopakuj automaticky nejasně dokončenou mutaci;
- rate limit nesmí být jedinou bezpečnostní kontrolou.

## Git a rozpracovaný workspace

- před úpravou zkontroluj `git status --short`;
- nesouvisející změny patří uživateli a musí zůstat zachované;
- nepoužívej `git reset --hard`, hromadné mazání ani přepis souborů;
- formátuj nebo opravuj pouze soubory v rozsahu úkolu;
- do commitu nezařazuj `.env`, logy, dočasné screenshoty ani vygenerované
  artefakty, pokud nejsou záměrnou součástí projektu.

## Kdy aktualizovat dokumentaci

Dokumentaci uprav současně s kódem, pokud se změní:

- hranice web/backend API;
- lokální příkazy nebo proměnné prostředí;
- adresářová struktura nebo vlastnictví komponent;
- i18n pravidla nebo podporované locale;
- designový kontrakt;
- databázový model nebo bezpečnostní tok.
