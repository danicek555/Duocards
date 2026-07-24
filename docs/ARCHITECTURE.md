# Architektura DuoCards

> Stav k 2026-07-24 (v1.0.0). Sdílený Fastify backend je volitelný: je-li
> připojený přes `SHARED_BACKEND_URL`, provoz jde přes něj, jinak web běží na
> vestavěných Next.js routách. Přepnutí je automatické. Viz README → Nasazení.

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
- `apiFetch()` pro fallback sdílený backend → vestavěné Next.js routy;
- timeout, health cache a circuit breaker;
- bezpečnější zacházení se zápisy, aby se mutace neopakovala po nejasném
  síťovém timeoutu;
- `parseApiError()` pro starý i nový error envelope.

Pravidlo:

- migrovaný endpoint volej přes `apiFetch()`;
- dosud nepřemigrovanou AI/public/live funkci volej přes její existující
  Next.js `/api/...` routu;
- nepřepisuj jeden styl na druhý pouze kvůli kosmetické konzistenci.

`next.config.ts` proxyuje `/shared-api/:path*` na Fastify `/api/v1` a
`/shared-health` na backendový health endpoint pouze tehdy, když je nastavená
proměnná `SHARED_BACKEND_URL` — bez ní (současný stav) proxy neexistuje a vše
obsluhují vestavěné routy.

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
- `StudySession` a `StudyReview` – studijní relace a append-only log každého
  opakování včetně FSRS telemetrie (stabilita, obtížnost, vybavitelnost,
  reakční doba) — viz `docs/SRS.md`;
- `LiveSession`, `LiveRound`, `LiveAnswer`, `LiveParticipant` – serverově
  autoritativní stav živých her v2;
- `LiveGame` a `LiveGamePlayer` – historie odehraných živých her;
- `Note` – poznámkový blok uživatele;
- `User.role` – `USER`/`ADMIN` pro přístup do admin přehledu;
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

### Studium (FSRS)

Plánování opakování řídí FSRS-6 (`src/lib/studyFsrs.ts`, knihovna `ts-fsrs`);
starší SM-2-lite (`src/lib/studySrs.ts`) zůstává pro frontu, streak a možnost
návratu. Každé opakování se idempotentně ukládá do `study_reviews` s plnou
telemetrií. Statistiky agreguje `GET /api/study/stats`
(`src/lib/studyStats.ts`) a zobrazuje `StudyStatsPanel` v dashboardu.

### Live game

Live Game v2 je primární implementace: kanonický kontrakt
`contracts/live-game-v1.json`, webové typy v
`src/features/live-game/contracts.ts` a autoritativní Fastify routy pod
`/api/v1/live/sessions`. Backend vytváří místnost a předgenerovaná kola,
vydává oddělené podepsané host/player tokeny, vynucuje jednu odpověď na
hráče (idempotency key) a počítá body; správná odpověď se do snapshotu
přidává až ve stavu `REVEAL`. Klient stav polluje — nikdy není zdrojem skóre.

Režimy: synchronizované (Classic Arena, Streak Combo, Survival, Team Battle,
Risk) sdílejí `currentQuestion` a hostitel je posouvá přes `/advance`;
self-paced (Sprint, Maraton) dávají každému hráči vlastní frontu otázek a
končí deadlinem `settings.endsAt` (líné dokončení při prvním snapshotu po
termínu). Volitelný mód psaných odpovědí nahrazuje výběr z možností.

Starší Ably prototyp (`LegacyLiveGamePage`, realtime chat) zůstává jako
záložní část UI; při změnách respektuj oddělení hosta, hráče a guest/join-only
režimu.

## Externí služby

- PostgreSQL / Prisma – perzistence;
- OpenAI – textové a obrazové AI funkce;
- Ably – realtime živá hra;
- Resend – ověřovací a resetovací e-maily;
- Google a Facebook – OAuth;
- Redis – distribuovaný rate limiting nebo pomocný stav dle konfigurace;
- Sentry – monitoring chyb a výkonu a bezpečně filtrovaná diagnostika;
- Vercel Analytics – cookieless měření návštěvnosti (bez souhlasu, běží vždy);
- Google Analytics 4 a Hotjar – návštěvnost, heatmapy a nahrávky relací;
  načítají se v prohlížeči až po udělení souhlasu (viz níže);
- Vercel – hosting webu; sdílený Fastify backend lze nasadit na libovolný Node
  hosting (např. Cloud Run) a připojit proměnnou `SHARED_BACKEND_URL`; není-li
  připojený, web přepne na vestavěné routy.

## Analytika a souhlas

Web měří anonymní návštěvnost přes Vercel Analytics (cookieless, bez souhlasu).
Analytika vyžadující souhlas – Google Analytics 4 a Hotjar – se v prohlížeči
načítá výhradně po odsouhlasení cookie banneru; volba se ukládá lokálně a bez
souhlasu se žádný skript třetích stran nespustí. Skripty a jejich stav řeší
`src/components/analytics/` (`ConsentProvider`, `CookieConsentBanner`,
`AnalyticsScripts`). Měřicí IDčka jsou veřejné client-side identifikátory v
`NEXT_PUBLIC_GA_MEASUREMENT_ID` a `NEXT_PUBLIC_HOTJAR_ID` (nejsou to secrets);
prázdná hodnota daný nástroj vypne.
