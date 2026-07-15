# DuoCards

DuoCards se postupně dělí na tři samostatně nasaditelné části, které používají
jednu PostgreSQL databázi a jeden verzovaný API kontrakt:

```text
web (Next.js) ----\
                  >---- backend (Fastify /api/v1) ---- PostgreSQL
iOS (SwiftUI) ----/
```

Repozitář je zatím záměrně monorepo, aby šlo bezpečně migrovat po jednotlivých
funkcích. `backend/` i `ios/` lze po stabilizaci oddělit do vlastních GitHub
repozitářů bez změny API kontraktu.

## Struktura

- `src/` – existující web v Next.js;
- `backend/` – nový Fastify + TypeScript + Prisma backend;
- `ios/` – nativní SwiftUI aplikace a Xcode projekt;
- `prisma/` – současný legacy databázový model;
- `ios/IMPLEMENTATION_PLAN.md` – plán úplné funkční a vizuální parity.

## Lokální spuštění celé vertikály

### 1. Backend

```sh
cp backend/.env.example backend/.env
npm install --prefix backend
npm --prefix backend run prisma:generate
npm run dev:backend
```

Do `backend/.env` doplň stejnou databázovou adresu a stejný `AUTH_SECRET`, jaký
používá web. Backend standardně poslouchá na `http://localhost:4000`.

Před prvním `prisma migrate deploy` je nutné ověřit zkopírovanou migration
baseline proti tabulce `_prisma_migrations` cílové databáze. Detailní bezpečný
postup je v `backend/README.md`.

### 2. Web

Do lokálního root `.env` přidej:

```dotenv
SHARED_BACKEND_URL=http://127.0.0.1:4000
NEXT_PUBLIC_SHARED_API_BASE_URL=/shared-api
```

Potom spusť:

```sh
npm install
npm run dev:web
```

Web bude přes same-origin `/shared-api` proxy používat nový backend pro login,
session, logout, seznam/detail sad, coiny a čtení word media. Zatím
nepřemigrované create, AI, public a live mutace zůstávají na původních Next.js
`/api` routách, takže web může fungovat během postupné migrace.

### 3. iOS v Xcode

1. Nech backend běžet na portu `4000`.
2. Otevři `ios/DuoCards.xcodeproj` v Xcode.
3. V horní liště vyber scheme **DuoCards** a libovolný iPhone Simulator.
4. Stiskni **Cmd+R**.

Simulator použije `http://localhost:4000`. Pro fyzický iPhone nastav ve scheme
proměnnou prostředí `DUOCARDS_API_BASE_URL` na HTTPS vývojovou adresu dostupnou
z telefonu. Další možnosti konfigurace a terminálový build jsou v
`ios/README.md`.

## Co je hotové v prvním řezu

- oddělený backend s kompatibilní cookie session a jednotným `/api/v1` error
  kontraktem;
- webový adaptér a proxy na nový backend s legacy fallbackem;
- iOS session restore, login/logout, dashboard, coiny, detail sady a základní
  studium karet;
- bezpečné backendové a nativní iOS vytvoření, úprava a smazání
  privátní textové sady včetně stabilních ID kartiček;
- backend unit testy, TypeScript build a iOS unit test target.

Nejde zatím o hotovou 1:1 kopii celé aplikace. Registrace, reset hesla,
pokročilý editor s AI a médii, veřejná knihovna a live funkcionalita jsou
další migrační vertikály popsané v implementačním plánu.

## Kontroly

```sh
npm --prefix backend run typecheck
npm run test:backend
npm run build:backend
npx tsc --noEmit
npm run build:ios
```
