# Architektura DuoCards

## Přehled systému

DuoCards má tři klientské a serverové vrstvy nad jednou PostgreSQL databází:

```text
Next.js web ─┬─ /shared-api → Fastify backend /api/v1 → PostgreSQL
             └─ /api        → Next.js route handlers → PostgreSQL

iOS aplikace ───────────────→ Fastify backend /api/v1 → PostgreSQL
```

Fastify backend je cílové sdílené API pro web a iOS. Next.js `/api` routy
zůstávají kompatibilní fallback a zároveň stále obsluhují dosud nepřemigrované
AI, veřejné a live funkce.

## Webová aplikace

Web používá Next.js App Router, React 19, TypeScript a Tailwind CSS.

- `src/app/` – stránky, layouty a vestavěné API routy;
- `src/app/page.tsx` a `src/app/HomeClient.tsx` – přihlášení a registrace;
- `src/app/dashboard/page.tsx` – hlavní přihlášená aplikace, studium, navigace
  a orchestrace panelů a modálů;
- `src/app/live-game/page.tsx` – lobby, hostování, připojení, realtime stav a
  chat živé hry;
- `src/components/` – znovupoužitelné formuláře, panely, modály a kartičky;
- `src/lib/` – autentizace, API adaptér, AI integrace, coiny, rate limiting a
  další doménové utility;
- `src/i18n/` – locale provider, ukládání jazyka a překladové slovníky;
- `src/middleware.ts` – ochrana rout a práce se session na hraně aplikace.

Komponenta s hooky, lokálním stavem nebo browser API musí mít `"use client"`.
Serverové utility a tajné konfigurace se nesmí dostat do klientského bundle.

## API vrstvy a fallback

`src/lib/apiUrl.ts` je adaptér pro endpointy dostupné na sdíleném backendu.
Poskytuje:

- `apiUrl()` pro sestavení URL;
- `apiFetch()` pro Cloud Run → Vercel fallback;
- timeout, health cache a circuit breaker;
- bezpečnější zacházení se zápisy, aby se mutace neopakovala po nejasném
  síťovém timeoutu;
- `parseApiError()` pro starý i nový error envelope.

Pravidlo:

- migrovaný endpoint volej přes `apiFetch()`;
- dosud nepřemigrovanou AI/public/live funkci volej přes její existující
  Next.js `/api/...` routu;
- nepřepisuj jeden styl na druhý pouze kvůli kosmetické konzistenci.

`next.config.ts` v produkci proxyuje `/shared-api/:path*` na Fastify `/api/v1`
a `/shared-health` na backendový health endpoint. Lokálně se proxy aktivuje
proměnnou `SHARED_BACKEND_URL`.

## Sdílený Fastify backend

`backend/` je lokální kopie samostatně nasaditelného backendu.

- `backend/src/app.ts` skládá Fastify aplikaci a registruje pluginy a routy;
- `backend/src/routes/` obsahuje autentizaci, registraci, reset hesla, uživatele,
  média, balíčky a health endpoint;
- `backend/src/lib/` obsahuje validační, bezpečnostní a databázovou logiku;
- `backend/prisma/` obsahuje backendové Prisma schéma a migrace;
- API kontrakt používá `/api/v1` a strukturované chybové kódy.

Web a backend musí sdílet kompatibilní `AUTH_SECRET`, cookie session a databázi.
Změna autentizace nebo databázového modelu se proto posuzuje v obou vrstvách.

## Datový model

Kořenové `prisma/schema.prisma` popisuje fallback datovou vrstvu webu.
Hlavní entity jsou:

- `User` – identita, locale, coiny a vazby na obsah;
- `FlashcardSet` – vlastník, jazyky, tagy, public stav a sdílecí kód;
- `Word` – slovo, překlad, obtížnost, výslovnost a volitelná média;
- `WordImage` a `WordAudio` – data URL média;
- `CompletionReward` a `AiGeneration` – jednorázové odměny a AI využití;
- `CoinTransaction` – auditovatelná historie každé změny zůstatku AI coinů;
- `LiveGame` a `LiveGamePlayer` – historie živých her;
- registrační a resetovací entity – krátkodobé bezpečnostní tokeny.

Vazby na uživatelská data obvykle používají `onDelete: Cascade`. Před změnou
schématu ověř dopad na kořenové i backendové schéma a na existující migrace.

## Hlavní produktové toky

### Balíčky kartiček

Dashboard načte uživatelovy balíčky, umožní filtrování, vytvoření ručně nebo
pomocí AI, úpravu, smazání a studium. Veřejný balíček má `publicCode`; připojená
kopie si může uchovávat `joinedFromCode`.

### AI a média

AI funkce zahrnují překlad, generování výslovnosti, obrázky, audio, OCR a chat.
Cena je centralizovaná v `src/lib/coin-costs.ts`. UI nesmí zobrazovat jinou cenu
než backendová logika. Změny zůstatku používají atomické operace v
`src/lib/coinEconomy.ts`; výdaje nikdy nesmí snížit zůstatek pod nulu a každá
změna musí ve stejné databázové transakci vytvořit `CoinTransaction`.

### Lokalizace

Aktivní locale poskytuje `I18nProvider`. Locale se ukládá lokálně, do cookies a
pro přihlášeného uživatele také přes API. Chybějící překlad padá na angličtinu.
Podrobnosti jsou v `docs/LOCALIZATION.md`.

### Live game

Live hra používá Ably pro realtime přítomnost, konfiguraci a chat. Výsledky se
ukládají přes API a zobrazují v historii. Při změnách respektuj oddělení hosta,
hráče a guest/join-only režimu.

Live Game v2 má kanonický kontrakt v `contracts/live-game-v1.json`, webové typy
v `src/features/live-game/contracts.ts` a autoritativní Fastify routy pod
`/api/v1/live/sessions`. Backend vytváří místnost a kola, vydává oddělené
podepsané host/player tokeny, kontroluje jednu odpověď na hráče a počítá body.
Správnou odpověď přidá do snapshotu až ve stavu `REVEAL`. Ably bude u v2 pouze
doručovat serverové události; klient nesmí být zdrojem skóre ani stavu kola.
Současné `/live-game` UI zatím zůstává kompatibilním prototypem, dokud na nový
kontrakt nebude převeden celý tok od lobby po report.

## Externí služby

- PostgreSQL / Prisma – perzistence;
- OpenAI – textové a obrazové AI funkce;
- Ably – realtime živá hra;
- Resend – ověřovací a resetovací e-maily;
- Google a Facebook – OAuth;
- Redis – distribuovaný rate limiting nebo pomocný stav dle konfigurace;
- Sentry – monitoring a bezpečně filtrovaná diagnostika;
- Vercel a Cloud Run – webový fallback a sdílený backend.
