# Duocards – Roadmap

> Stav k 2026-07-24 (v1.0.0). Strukturovaný přehled nápadů a priorit,
> průběžně aktualizovaný podle skutečného stavu kódu (Next.js + Fastify +
> Prisma/PostgreSQL). Hotové položky zůstávají se stručným popisem realizace.

Legenda náročnosti: **S** (malá) · **M** (střední) · **L** (velká) · **XL** (samostatný projekt)

---

## P1 – Dotažení rozpracovaného

### 1.1 Veřejná knihovna flashcards — **M** — ✅ hotovo (07/2026)
Katalog veřejných sad s vyhledáváním, tagy, náhledem slov a připojením kódem.
- Realizace: `PublicLibraryPanel` přímo v dashboardu, browse/search endpoint,
  ochrana proti opakovanému připojení (`joinedFromCode`), kopírovatelné kódy.

### 1.2 Historie a statistiky živých her — **M** — ✅ hotovo (07/2026)
- Realizace: modely `LiveGame` + `LiveGamePlayer`, ukládání výsledků po hře,
  `LiveGameHistoryPanel` v dashboardu s detailem hry a výsledkovou tabulí.

### 1.3 Nákup mincí za peníze — **M**
Možnost dokoupit coins.
- Stav: ekonomika mincí je hotová a transakční (`CoinTransaction` ledger,
  atomické odečty, žádné dvojité odměny). Chybí platební brána a webhook.
- Pozn.: vyžaduje rozhodnutí o poskytovateli plateb a o cenotvorbě.

---

## P2 – Učení a zábava (herní módy)

### 2.1 Výběr více sad před hrou — **S** — ✅ hotovo (07/2026)
- Realizace: multi-výběr sad v dialogu vytvoření živé hry; otázky se losují
  ze sjednocené zásoby.

### 2.2 Non-AI hra: Přesmyčky — **M**
Seřadit zpřeházená písmena slova do správného tvaru a spárovat s překladem.

### 2.3 Non-AI hra: Typing game — **M**
Vygenerovaný text, uživatel za časový limit napíše co nejvíce slov, odměna
v podobě AI coins.

### 2.4 AI hra: Story-telling s doplňováním — **L** — rozpracováno (plán)
Výběr sady + tématu, AI vygeneruje příběh s vynechanými slovy, uživatel
doplňuje; stojí AI coins; provázané s poznámkami.
- Stav: kompletní produktový a technický plán je
  v [`STORY_MODE_PLAN.md`](STORY_MODE_PLAN.md). Implementace zatím nezačala.

### 2.5 Katalog dalších živých režimů — **S–L dle režimu** — průběžně
- Hotové režimy (07/2026), všech 9 volitelných v dialogu vytvoření hry:
  Classic Arena, **Accuracy** (bez bonusu za rychlost), Streak Combo,
  Survival, **Team Battle** (červení × modří, průměr na hráče), **Risk**
  (sázky z banku), **Sprint** (2 minuty, každý vlastním tempem),
  **Maraton / domácí úkol** (místnost 1 h – 7 dní, připojení kdykoli) a
  **Co-op mise** (5 minut, společný týmový součet) + průřezová volba
  psaných odpovědí a detailní „Jak to funguje?" popup u každého režimu.
- Navržené a rozepsané v [`LIVE_GAME_PRODUCT_PLAN.md`](LIVE_GAME_PRODUCT_PLAN.md):
  Lingo, Riskuj! (tabule), Aukce otázek, Štafeta, Bingo slovíček, Diktát,
  Pexeso živě, Závod s duchem, Turnajový pavouk, Živý příběh.
- Doporučené pořadí: Lingo (S–M) → Riskuj! (M) → Závod s duchem (M).

---

## P3 – Podpora učení a obsah

### 3.1 Blok poznámek — **M** — ✅ hotovo (07/2026)
- Realizace: model `Note`, panel poznámek v dashboardu, převod poznámek na
  kartičky.

### 3.2 Statistiky procvičování a streak — **M** — ✅ hotovo, překročeno (07/2026)
- Realizace: modely `StudySession`/`StudyReview`, denní streak s časovými
  pásmy, panel Statistiky (heatmapa s tooltipem, denní přesnost, předpověď
  zátěže, síla paměti, nejtěžší slova, přehled sad, kalibrace plánovače).
- Navíc: plánovač **FSRS-6** s plnou telemetrií opakování — viz
  [`SRS.md`](SRS.md); dlouhodobý cíl je vlastní algoritmus trénovaný na logu.

### 3.3 Kontrola duplicit při AI generování — **M** — ✅ hotovo (07/2026)
- Realizace: přepínač „Pouze nová slovíčka" (výchozí zapnuto); existující
  slova jazykové dvojice v promptu (limit 300) + normalizovaná deduplikace
  po generování (velikost písmen, diakritika, interpunkce) proti celé zásobě
  i uvnitř dávky. Účtuje se jen skutečně vytvořený počet slov. Navíc
  `POST /api/words/[id]/regenerate` — přegenerování obrázku (80 mincí) nebo
  překladu (1 mince) přímo z karty.

### 3.4 Kvalita obrázků — odstranění zbytkových písmen — **S–M** — ✅ hotovo
- Vrstva 1: prompt přes vizuální scénu (`imageScene`), flat ikonový styl,
  bez kontraproduktivních negací.
- Vrstva 2: post-kontrola vision modelem + omezené regenerace
  (`IMAGE_TEXT_CHECK=off` vypne, `IMAGE_TEXT_CHECK_MAX_RETRIES=0..3`,
  výchozí 1). Telemetrie `image_text_check`.
- Vrstva 3: ruční přegenerování obrázku na kartě za mince.
- Změřeno 2026-07-22 (`scripts/measure-image-text.ts`, gpt-image-2, 8 slov
  vč. newspaper/menu): 0 detekcí textu v obou variantách; dlouhodobou míru
  doloží produkční telemetrie.

---

## P4 – Platforma

### 4.1 iOS Swift aplikace — **XL** — probíhá v samostatném repozitáři
- [duocards-ios](https://github.com/danicek555/duocards-ios): session,
  login/logout, dashboard, coiny, detail sady a základní studium karet.
- Web-side část hotová: mobilní overlay směruje na iOS aplikaci, web je
  desktop-first.

### 4.2 Admin přehled — ✅ hotovo (07/2026)
- `/admin` (role `ADMIN` v DB): uživatelé, detail uživatele, systémové
  metriky, rate limit na admin API, plovoucí vstup z dashboardu.

---

## Otevřené otázky k rozhodnutí
- Platby (1.3): poskytovatel a cenotvorba.
- Vlastní SRS algoritmus: kdy je v `study_reviews` dost dat na optimalizaci
  vah (viz `SRS.md`, kap. 6).
- iOS (4.1): tempo dorovnávání funkcí webu.
