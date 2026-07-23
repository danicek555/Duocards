# DuoCards

Webová aplikace na učení slovíček s kartičkami: FSRS opakování, AI generování
setů, živé multiplayer hry a statistiky studia. Aktuální stav odpovídá verzi
**v1.0.0** (2026-07-23) — podrobnosti v [CHANGELOG.md](CHANGELOG.md).

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

## Co v1.0.0 umí

- **Kartičky a sety** – ruční tvorba, tagy, veřejné kódy, veřejná knihovna
  s náhledem slov, OCR import z fotky.
- **Chytré učení** – plánovač FSRS-6 (`ts-fsrs`) s cílovou retencí 90 %,
  reakční doba jako implicitní signál, kompletní telemetrie opakování pro
  budoucí vlastní algoritmus (`docs/SRS.md`).
- **Statistiky** – streak, heatmapa aktivity, denní přesnost, předpověď
  zátěže, síla paměti, nejtěžší slova, kalibrace plánovače.
- **AI generování** – slovíčka s deduplikací proti existující zásobě,
  obrázky přes vizuální scény s volitelnou vision kontrolou zbytkového
  textu, výslovnost (IPA), audio, přegenerování jednotlivé kartičky.
- **Živé hry** – 7 režimů (Classic Arena, Streak Combo, Survival, Sprint,
  Maraton, Team Battle, Risk), psané odpovědi, QR pozvánky, historie her;
  serverově autoritativní engine s idempotentními odpověďmi.
- **Ekonomika mincí** – transakční ledger bez záporných zůstatků, denní
  odměny, odměny za dokončení setu.
- **Účty** – e-mailové ověření, Google/Facebook OAuth, Argon2id, bezpečný
  reset hesla; admin přehled `/admin` (role `ADMIN` v DB).
- **Lokalizace** – 30 jazyků s anglickým fallbackem.

## Struktura

- `src/` – web v Next.js (App Router) včetně vestavěných `/api` rout;
- `backend/` – Fastify + TypeScript + Prisma backend (`/api/v1`, live hry);
- `prisma/` – sdílený databázový model a migrace;
- `contracts/` – verzovaný kontrakt live her sdílený webem i backendem;
- `docs/` – architektura, vývoj, design systém, SRS, produktové plány.

## Lokální spuštění celé vertikály

### 1. Backend

```sh
cp backend/.env.example backend/.env
npm install --prefix backend
npm --prefix backend run prisma:generate
npm run dev:backend
```

Do `backend/.env` doplň stejnou databázovou adresu a stejný `AUTH_SECRET`,
jaký používá web. Pro skutečné ověřovací e-maily nastav `RESEND_API_KEY` a
`FROM_EMAIL`; čistě lokálně lze s `NODE_ENV=development` explicitně použít
`VERIFICATION_EMAIL_MODE=console`. `PUBLIC_APP_URL` nastav na veřejný origin
webu; lokálně typicky `http://localhost:3000`. Backend standardně poslouchá
na `http://localhost:4000`.

Před prvním `prisma migrate deploy` je nutné ověřit zkopírovanou migration
baseline proti tabulce `_prisma_migrations` cílové databáze. Detailní bezpečný
postup je v `backend/README.md`.

### 2. Web

```sh
cp .env.example .env
npm install
npm run dev:web
```

Do lokálního root `.env` přidej:

```dotenv
SHARED_BACKEND_URL=http://127.0.0.1:4000
NEXT_PUBLIC_SHARED_API_BASE_URL=/shared-api
# Volitelně vynutí vestavěné Next.js /api routy:
NEXT_PUBLIC_API_BACKEND=vercel
```

### 3. iOS v Xcode

Nativní aplikaci otevři ze samostatného repozitáře
[duocards-ios](https://github.com/danicek555/duocards-ios).

## Nasazení

- **Web:** Vercel. Build (`npm run build:vercel`) aplikuje migrace, vygeneruje
  Prisma klienta a sestaví Next.js. Povinné proměnné: `PRISMA_DATABASE_URL`
  (případně `DIRECT_DATABASE_URL`), **`AUTH_SECRET`** (bez něj produkční
  server odmítne start), `OPENAI_API_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`,
  OAuth klíče dle potřeby.
- **Sdílený backend (živé hry):** libovolný Node.js hosting (Railway, Fly.io,
  Render, vlastní VPS/Docker — `backend/Dockerfile`). Adresa se webu předává
  výhradně proměnnou `SHARED_BACKEND_URL`; **Google Cloud Run se nepoužívá**
  a v kódu na něj nejsou žádné pevné odkazy. Bez nastaveného
  `SHARED_BACKEND_URL` web běží čistě na vestavěných Next.js routách
  (živé hry v2 pak nejsou dostupné).
- Web při výpadku sdíleného backendu automaticky přepíná na vestavěné
  `/api` routy; aktivní backend je vidět v Nastavení.

## Bezpečnost

Zavedeno ve v1.0.0: Argon2id, HMAC podepsané session tokeny s revokací,
httpOnly + Secure + SameSite cookies, rate limity na auth i admin API,
CORS allowlist na backendu, vlastnické kontroly na všech datových
endpointech, parametrizované SQL (Prisma), bezpečnostní hlavičky (nosniff,
X-Frame-Options DENY, HSTS, Permissions-Policy), žádná tajemství v gitu
(`.env*` ignorováno, pouze `*.example`).

Známé přijaté riziko (stav k 2026-07-23): `npm audit` hlásí zranitelnosti
pouze v build/dev řetězci (`sharp`/libvips přes next/image — na Vercelu běží
optimalizace obrázků na jejich infrastruktuře, `postcss`, `@prisma/dev`);
runtime závislosti jsou záplatované (Next 15.5.21, Fastify router 9.7.0).
Follow-up: Content-Security-Policy s nonce (vyžaduje úpravu inline skriptů
Next.js).

## Produktové plány a dokumentace

- [Live Game 2.0](docs/LIVE_GAME_PRODUCT_PLAN.md) · [Story mód](docs/STORY_MODE_PLAN.md)
- [Roadmapa](docs/ROADMAP.md) · [SRS / FSRS](docs/SRS.md)
- [Architektura](docs/ARCHITECTURE.md) · [Vývoj a kontroly](docs/DEVELOPMENT.md)
- [Design systém](docs/DESIGN_SYSTEM.md) · [Lokalizace](docs/LOCALIZATION.md)

## Kontroly

```sh
npx tsc --noEmit                     # typy webu
npm --prefix backend run typecheck   # typy backendu
npm run test:backend                 # backend testy (77)
npm run test:study && npm run test:study:fsrs && npm run test:coins
npm run build:backend && npx next build
```
