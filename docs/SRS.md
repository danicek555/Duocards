# Spaced repetition v DuoCards — FSRS a cesta k vlastnímu algoritmu

Tento dokument popisuje, jak funguje plánování opakování slovíček po přechodu
na FSRS, jaká data se sbírají při každém opakování a jak z nich později
postavit a vyhodnotit vlastní algoritmus.

## 1. Architektura

```
Klient (dashboard)                    Server                          DB
┌──────────────────┐   POST /api/study/reviews   ┌─────────────────┐
│ Vím / Nevím      │ ──────────────────────────► │ reviews/route.ts│
│ + responseMs     │   {rating, responseMs, …}   │  │              │
└──────────────────┘                             │  ▼              │
                                                 │ studyFsrs.ts    │──► words (stav plánovače)
                                                 │ (ts-fsrs, FSRS-6)│──► study_reviews (log/telemetrie)
                                                 └─────────────────┘
```

- **`src/lib/studyFsrs.ts`** — jediné místo s plánovací logikou. Wrapper nad
  knihovnou [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
  (MIT, implementuje FSRS-6). Funkce `calculateNextReviewFsrs(state, rating,
  {now, responseMs})` je čistá (bez DB, bez vedlejších efektů) a plně pokrytá
  testy — **vlastní algoritmus později = výměna této jedné funkce**.
- **`src/lib/studySrs.ts`** — původní SM-2-lite. Zůstává kvůli testům,
  seedování a možnosti návratu; frontou a streakem (`selectStudyQueue`,
  `calculateStudyStreak`) se řídí dál.
- **`src/app/api/study/reviews/route.ts`** — transakčně uloží opakování
  (idempotentně), aktualizuje slovo a zapíše telemetrii.

## 2. Jak FSRS funguje (model DSR)

FSRS modeluje paměť třemi veličinami na kartu:

- **S — stabilita**: počet dní, za který klesne pravděpodobnost vybavení na
  90 %. Roste s každým úspěšným opakováním; růst je tím větší, čím nižší byla
  vybavitelnost v okamžiku opakování (efekt obtížného vybavení).
- **D — obtížnost** (1–10): jak těžko se stabilita u této karty zvyšuje.
  Chyby ji zvedají, úspěchy pomalu snižují (mean reversion).
- **R — vybavitelnost**: predikovaná pravděpodobnost, že si kartu právě teď
  vybavíte; klesá s časem podle mocninné křivky zapomínání
  `R(t) = (1 + faktor · t/S)^(−decay)`.

Další termín se plánuje tak, aby R v den opakování klesla přesně na **cílovou
retenci** — u nás `DESIRED_RETENTION = 0.9`. Snížením této konstanty se
prodlouží intervaly (méně opakování, více zapomínání) a naopak. Chování řídí
~20 vah `w0…w20`; používáme výchozí sadu FSRS-6 natrénovanou na stovkách
milionů reálných opakování uživatelů Anki.

## 3. Mapování na dvoutlačítkové UI

| Akce uživatele | FSRS grade | Poznámka |
|---|---|---|
| Nevím | `Again` | lapse; stabilita klesne, obtížnost vzroste |
| Vím do 10 s | `Good` | standardní úspěch |
| Vím za ≥ 10 s (`HARD_RESPONSE_MS`) | `Hard` | váhání = slabší paměťový signál; kratší interval |
| — (rezerva) | `Easy` | zatím nevyužito; prostor pro budoucí UI |

Reakční doba se měří na klientovi (`cardShownAtRef` v dashboardu — čas od
zobrazení karty po stisk tlačítka) a posílá se jako `responseMs`.

**Odchylky od čistého FSRS (vědomá rozhodnutí):**

1. **„Nevím" vrací kartu za 10 minut v rámci sezení** (`AGAIN_DELAY_MS`),
   interval 0 — zachovává původní chování aplikace. FSRS stav (S, D, lapses)
   se přitom aktualizuje podle `Again`.
2. **`learning_steps` a `relearning_steps` jsou prázdné** — plánujeme po
   dnech; sub-denní kroky nahrazuje bod 1.
3. **Fuzz zapnutý** — intervaly se náhodně rozptylují o ±, aby se karty
   neshlukovaly do stejných dní.
4. **Maximální interval 365 dní** (`maximum_interval`).
5. **Legacy pole `reviewEase` a `reviewStreak` se dál udržují podle starých
   pravidel** — kdykoli lze přepnout zpět na SM-2-lite bez migrace dat.

## 4. Seedování existujících slov

Slova naplánovaná starým algoritmem nemají S/D. Při prvním FSRS opakování je
`seedCardFromLegacy` odhadne:

- `S ≈ reviewIntervalDays` (interval při 90% retenci ~ stabilita),
- `D = clamp(11 − (ease − 130) · 9/130, 1, 10)` (ease 130→D≈10, 260→D=2),
- počty opakování/lapsů se převezmou z `reviewCount`/`lapseCount`.

Odhad se dalšími opakováními rychle zpřesní; žádná datová migrace není nutná.

## 5. Co se ukládá — schéma

**`words`** (stav plánovače, přepisuje se):
`reviewStability Float?`, `reviewDifficulty Float?` + původní pole
(`reviewIntervalDays`, `reviewEase`, `reviewStreak`, `reviewCount`,
`correctReviewCount`, `lapseCount`, `lastReviewedAt`, `nextReviewAt`).

**`study_reviews`** (append-only log — trénovací data; nikdy nemazat):

| Sloupec | Význam |
|---|---|
| `rating` | co stiskl uživatel (`KNOW`/`AGAIN`) |
| `fsrsRating` | použitý FSRS grade (`AGAIN`/`HARD`/`GOOD`/`EASY`) |
| `responseMs` | reakční doba (ms, strop 10 min) |
| `elapsedDays` | skutečně uplynulé dny od minulého opakování (desetinné) |
| `retrievability` | **predikce R v okamžiku opakování** — klíč ke kalibraci |
| `stabilityBefore/After`, `difficultyBefore/After` | stav paměťového modelu před/po |
| `intervalBeforeDays/AfterDays`, `easeAfter` | legacy veličiny |
| `scheduler` | verze algoritmu (`fsrs-6`; starší řádky `sm2-lite`) |
| `desiredRetention` | cílová retence platná při opakování |
| `reviewedAt`, `wordId`, `userId`, `sessionId`, `idempotencyKey` | kontext |

Tím vzniká pro každé opakování dvojice **(predikce, skutečnost)** — přesně to,
co je potřeba k trénování a poctivému porovnávání algoritmů.

## 6. Jak z toho postavit vlastní algoritmus

1. **Sbírejte data** (děje se automaticky). Smysluplné minimum pro první
   optimalizaci je řádově tisíce opakování.
2. **Změřte kalibraci FSRS na vlastních datech**: seskupte řádky logu podle
   predikované `retrievability` (biny 0.70–0.75, …, 0.95–1.00) a spočtěte
   skutečnou úspěšnost (`rating = KNOW`) v každém binu. Odchylka predikce od
   reality = prostor pro zlepšení. Metriky: log-loss, Brier score, RMSE(bins).
3. **Re-optimalizujte váhy FSRS** na vlastním logu — nejjednodušší cesta
   k „vlastnímu" algoritmu: export logu do CSV ve formátu
   `card_id, review_time, review_rating, review_state` a použití
   [`fsrs-optimizer`](https://github.com/open-spaced-repetition/fsrs-optimizer)
   (Python) či `fsrs-rs`. Výsledných ~20 vah se předá v
   `generatorParameters({ w: [...] })` v `studyFsrs.ts` — jedna řádka.
   Lze i per-user (sloupec `userId` v logu).
4. **Přidejte doménové příznaky, které FSRS nezná** — největší prostor:
   délka slova, frekvence slova v jazyce, jazyková dvojice, kognát/ne,
   přítomnost obrázku/audia, denní doba, `responseMs`. Implementačně jako
   vrstva nad FSRS (úprava počáteční S/D nebo korekce intervalu), nebo jako
   vlastní model predikující R.
5. **Benchmark proti logu, ne pocitově**: log je zamrzlá testovací sada —
   přehrajte historii každé karty kandidátním algoritmem a porovnejte
   predikce se skutečnými výsledky (stejné metriky jako v bodu 2). Nový
   algoritmus nasadit jen pokud vyhraje; při nasazení zvýšit `scheduler`
   (např. `duocards-1`), aby zůstalo dohledatelné, čím byl který řádek
   naplánován.
6. **Výměna jádra**: nový algoritmus = nová implementace
   `calculateNextReviewFsrs` (stejná signatura), testy v
   `src/lib/studyFsrs.test.ts` vedle.

## 7. Konstanty a kde je měnit

| Konstanta | Hodnota | Kde |
|---|---|---|
| `DESIRED_RETENTION` | 0.9 | `src/lib/studyFsrs.ts` |
| `HARD_RESPONSE_MS` | 10 000 ms | tamtéž |
| `AGAIN_DELAY_MS` | 10 min | tamtéž |
| `maximum_interval` | 365 dní | tamtéž (`generatorParameters`) |
| váhy `w` | výchozí FSRS-6 | tamtéž — sem patří optimalizované váhy |

## 8. Testy a migrace

- Testy: `npm run test:study:fsrs` (FSRS wrapper), `npm run test:study`
  (legacy + fronta + streak).
- Migrace: `prisma/migrations/20260722100000_add_fsrs_scheduler/` — čistě
  aditivní (nullable sloupce, default `scheduler`), aplikuje se při deployi
  přes `prisma migrate deploy`. Zpětně kompatibilní se starým kódem.

## 9. Možné další kroky

- Denní limit nových slov ve frontě (ochrana proti lavině po importu setu).
- Řazení fronty podle vybavitelnosti (nejohroženější karty první).
- Per-user `desiredRetention` jako nastavení.
- Využití `Easy` grade (třetí tlačítko či dlouhý stisk „Vím").
- Export logu + optimalizace vah, jakmile bude dost dat (bod 6.3).
