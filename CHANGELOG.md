# Changelog

## v1.0.0 — 2026-07-23

První veřejná verze DuoCards.

### Učení

- **FSRS-6 plánovač opakování** (`ts-fsrs`): paměťový model obtížnost ×
  stabilita × vybavitelnost, cílová retence 90 %, fuzz proti shlukování,
  seedování starších kartiček z SM-2 stavu bez migrace dat. Reakční doba
  odpovědi se využívá jako implicitní signál (pomalé „Vím" = Hard).
- **Telemetrie opakování**: každá odpověď ukládá predikovanou vybavitelnost,
  stabilitu/obtížnost před a po, reakční dobu a verzi plánovače — základ pro
  budoucí vlastní algoritmus (postup v `docs/SRS.md`).
- **Statistiky studia** (tlačítko v dashboardu): streak s plamínkem, heatmapa
  aktivity s detailním tooltipem, denní přesnost, předpověď zátěže, síla
  paměti dle stability, nejtěžší slova, přehled sad, kalibrace plánovače.
- Poznámkový blok s převodem poznámek na kartičky.

### AI generování

- Deduplikace proti existující slovní zásobě uživatele (prompt exclusion list
  + normalizovaný post-filtr, volba „pouze nová slovíčka"). Mince se účtují
  podle skutečně vytvořených slov.
- Kvalita obrázků: prompt přes vizuální scénu konceptu (bez citovaného slova),
  flat ikonový styl, volitelná vision kontrola zbytkového textu s omezenými
  regeneracemi (`IMAGE_TEXT_CHECK`, `IMAGE_TEXT_CHECK_MAX_RETRIES`).
- Přegenerování špatného obrázku nebo překladu přímo na kartičce.

### Živé hry (multiplayer)

- Serverově autoritativní engine (Fastify `/api/v1/live`, PostgreSQL,
  polling + idempotentní odpovědi) se 7 režimy: Classic Arena, Streak Combo,
  Survival, **Sprint** (2 minuty, vlastní tempo), **Maraton / domácí úkol**
  (místnost 1 h – 7 dní, připojení kdykoli), Team Battle (červení × modří,
  průměr na hráče) a Risk (sázky z banku). Psané odpovědi jako volitelný mód.
- Detailní popup „Jak to funguje?" u každého režimu v dialogu vytváření hry.
- QR pozvánky, zvuky, konfety, historie odehraných her s detaily.

### Ekonomika a účty

- Atomická mince (transakční ledger, žádné záporné zůstatky ani dvojité
  odměny), denní odměna, odměny za dokončení setu.
- E-mailové ověření účtu, Google/Facebook OAuth, reset hesla s uzamykáním
  proti souběhu, Argon2id hašování, rate limity na auth endpointech.

### Platforma

- Veřejná knihovna setů s náhledem slov a kopírováním kódem.
- Admin přehled `/admin` (role v DB): uživatelé, systémové metriky.
- Lokalizace do 30 jazyků (fallback angličtina), Midnight Indigo design
  systém, desktop-first web + průběžně vznikající iOS aplikace
  ([duocards-ios](https://github.com/danicek555/duocards-ios)).

### Bezpečnost (v rámci přípravy v1)

- `AUTH_SECRET` je v produkci povinný — server bez něj odmítne start
  (odstraněn nebezpečný veřejný fallback).
- Globální bezpečnostní hlavičky (nosniff, X-Frame-Options DENY, HSTS,
  Permissions-Policy, Referrer-Policy). CSP je dokumentovaný follow-up.
- Odstraněny natvrdo zapsané URL Google Cloud Run — sdílený backend se
  konfiguruje výhradně přes `SHARED_BACKEND_URL`; nasazení Cloud Run se
  nepoužívá.
- Next.js aktualizován na záplatovanou 15.5.21, opraveny tranzitivní
  zranitelnosti (fast-uri, minimatch, brace-expansion). Zbývající nálezy
  auditu jsou pouze v build/dev nástrojích (viz README, sekce Bezpečnost).
