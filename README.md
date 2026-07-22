# DuoCards

DuoCards používá tři samostatně nasaditelné části, jednu PostgreSQL databázi a
jeden verzovaný API kontrakt:

```text
web (Next.js) ----\
                  >---- backend (Fastify /api/v1) ---- PostgreSQL
iOS (SwiftUI) ----/
```

Tento repozitář obsahuje web a lokální kopii backendu pro vývoj a záložní
provoz. Produkční backend a iOS aplikace mají vlastní repozitáře:

- [duocards-backend](https://github.com/danicek555/duocards-backend)
- [duocards-ios](https://github.com/danicek555/duocards-ios)

## Struktura

- `src/` – existující web v Next.js;
- `backend/` – lokální Fastify + TypeScript + Prisma backend;
- `prisma/` – databázový model webového Vercel fallbacku.

## Lokální spuštění celé vertikály

### 1. Backend

```sh
cp backend/.env.example backend/.env
npm install --prefix backend
npm --prefix backend run prisma:generate
npm run dev:backend
```

Do `backend/.env` doplň stejnou databázovou adresu a stejný `AUTH_SECRET`, jaký
používá web. Pro skutečné ověřovací e-maily nastav `RESEND_API_KEY` a
`FROM_EMAIL`; čistě lokálně lze s `NODE_ENV=development` explicitně použít
`VERIFICATION_EMAIL_MODE=console`. `PUBLIC_APP_URL` nastav na veřejný origin
webu, který bude hostovat odkazy pro obnovu hesla; lokálně typicky
`http://localhost:3000`. Backend standardně poslouchá na
`http://localhost:4000`.

Před prvním `prisma migrate deploy` je nutné ověřit zkopírovanou migration
baseline proti tabulce `_prisma_migrations` cílové databáze. Detailní bezpečný
postup je v `backend/README.md`.

### 2. Web

Do lokálního root `.env` přidej:

```dotenv
SHARED_BACKEND_URL=http://127.0.0.1:4000
NEXT_PUBLIC_SHARED_API_BASE_URL=/shared-api
# Volitelně vynutí vestavěný Vercel API fallback:
NEXT_PUBLIC_API_BACKEND=vercel
```

V produkčním buildu web standardně proxyuje `/shared-api` na
`https://duocards-backend-731652720086.europe-west1.run.app/api/v1`. Obě hodnoty
lze přepsat proměnnými `SHARED_BACKEND_URL` a
`NEXT_PUBLIC_SHARED_API_BASE_URL` bez změny zdrojového kódu.

Pokud Cloud Run neodpoví, vrátí 5xx nebo překročí osm sekund, web přepne na
vlastní Vercel `/api` routy. Před zápisovými požadavky nejdřív kontroluje health
endpoint, aby zbytečně neposlal stejný zápis na oba backendy. Vercel a Cloud Run
musí používat stejnou databázi a stejný `AUTH_SECRET`.
Aktivní backend je vidět v dashboardovém Nastavení podle posledního úspěšného
API požadavku. Hodnota `NEXT_PUBLIC_API_BACKEND=vercel` Cloud Run pro web úplně
obejde; bez ní zůstává automatický režim Cloud Run → Vercel fallback.

Potom spusť:

```sh
npm install
npm run dev:web
```

Web bude přes same-origin `/shared-api` proxy používat nový backend pro login,
registraci, ověření e-mailu, resend ověřovacího kódu, session, logout,
obnovu hesla, seznam/detail sad, coiny a čtení word media. Identity cesty pod
`/api/auth/*` zůstávají funkční jako Vercel záloha pro výpadek Cloud Run.
Zatím nepřemigrované AI, public a live mutace zůstávají na původních
Next.js `/api` routách.

### 3. iOS v Xcode

Nativní aplikaci otevři ze samostatného repozitáře
[duocards-ios](https://github.com/danicek555/duocards-ios). Její README obsahuje
postup pro Simulator, fyzický iPhone i lokální fallback backend.

## Co je hotové v aktuálních řezech

- oddělený backend s kompatibilní cookie session a jednotným `/api/v1` error
  kontraktem;
- webový adaptér, same-origin proxy a bezpečné compatibility identity aliasy;
- iOS session restore, login/logout, dashboard, coiny, detail sady a základní
  studium karet;
- bezpečná e-mailová registrace na webu i iOS, šest číslic, resend a
  automatické přihlášení po ověření;
- jednotná veřejná odpověď při vyžádání obnovy hesla, jednorázový 30minutový
  reset token a nativní iOS flow pro vložení tokenu nebo celého HTTPS odkazu;
- bezpečné backendové a nativní iOS vytvoření, úprava a smazání
  privátní textové sady včetně stabilních ID kartiček;
- základ Live Game v2: verzovaný kontrakt, serverové místnosti, host/player
  tokeny, autoritativní kola, idempotentní odpovědi a bodování;
- backend unit testy, TypeScript build a iOS unit test target.

Nejde zatím o hotovou 1:1 kopii celé aplikace. Dashboardové filtry a odměny,
pokročilý editor s AI a médii, veřejná knihovna a live funkcionalita jsou
další migrační vertikály popsané v implementačním plánu.

## Produktové plány

- [Live Game 2.0](docs/LIVE_GAME_PRODUCT_PLAN.md) – herní režimy, nový Live Hub,
  design, realtime architektura, bezpečnost a postup implementace inspirovaný
  ověřenými principy Kahootu a Blooketu.

## Vývojová dokumentace

- [Pravidla pro Codex a další agenty](docs/AGENTS.md)
- [Architektura a datové toky](docs/ARCHITECTURE.md)
- [Lokální vývoj, kontroly a bezpečnost](docs/DEVELOPMENT.md)
- [UI a design systém](docs/DESIGN_SYSTEM.md)
- [Lokalizace](docs/LOCALIZATION.md)

## Kontroly

```sh
npm --prefix backend run typecheck
npm run test:backend
npm run build:backend
npx tsc --noEmit
```
