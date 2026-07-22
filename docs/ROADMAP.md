# Duocards – Roadmap

Strukturovaný přepis nápadů z `improvements.md`. Položky jsou seřazené podle
priority a doplněné o odhad náročnosti a poznámku k současnému stavu kódu
(Next.js + Prisma/PostgreSQL).

Legenda náročnosti: **S** (malá) · **M** (střední) · **L** (velká) · **XL** (samostatný projekt)

---

## P1 – Dotažení rozpracovaného

Funkce, které už mají základ v datovém modelu nebo ve struktuře aplikace.

### 1.1 Veřejná knihovna flashcards — **M**
Přepínání viditelnosti sad, upload do veřejného katalogu, vyhledávání podle
názvu a tagů.
- Stav: model `FlashcardSet` už má `isPublic`, `publicCode`, `tags`,
  `joinedFromCode`. Chybí katalog/vyhledávací UI a veřejný browse endpoint.

### 1.2 Historie a statistiky živých her — **M**
Přehled odehraných her pod hlavními tlačítky, detail po skončení hry
(přesnost, jména hráčů, kdo vyhrál), ne jen počet hráčů.
- Stav: existují adresáře `src/app/live` a `src/app/live-game`. Chybí
  persistence výsledků (nový model, např. `LiveGame` + `LiveGameResult`).

### 1.3 Nákup mincí za peníze — **M**
Možnost dokoupit coins.
- Stav: ekonomika mincí existuje (`User.coins`, `AiGeneration`,
  `CompletionReward`). Chybí platební brána (Stripe apod.) a webhook.
- Pozn.: vyžaduje rozhodnutí o poskytovateli plateb a o cenotvorbě.

---

## P2 – Učení a zábava (nové herní módy)

### 2.1 Výběr více sad před hrou — **S**
Před spuštěním hry zvolit jednu či více sad a procvičovat je dohromady.
Předpoklad pro většinu her níže.

### 2.2 Non-AI hra: Přesmyčky — **M**
Seřadit zpřeházená písmena slova do správného tvaru a spárovat s překladem
(přeházené je slovo i překlad).

### 2.3 Non-AI hra: Typing game — **M**
Vygenerovaný text, uživatel za časový limit napíše co nejvíce slov, odměna
v podobě AI coins.

### 2.4 AI hra: Story-telling s doplňováním — **L**
Výběr sady + tématu, AI vygeneruje příběh s vynechanými slovy a slovní
zásobou (vocab bank), uživatel doplňuje, kontrola, navázání „pokračováním“
s jinými sadami. Stojí AI coins. Provázané s poznámkami (2.x níže).

---

## P3 – Podpora učení a obsah

### 3.1 Blok poznámek — **M**
Volný blok poznámek (vlevo dole) pro libovolný text — např. neznámé slovo
z generovaného příběhu. Ideálně s ukládáním.
- Stav: bez podpory v modelu. Nový model `Note` (volně, případně vázaný na
  hru/příběh).

### 3.2 Statistiky procvičování a streak — **M**
Jak často uživatel procvičuje, ve které dny tvoří sady, denní streak.
- Stav: bez tracking modelu. Nutné logovat tréninkové aktivity
  (nový model `PracticeSession` / `ActivityLog`).

### 3.3 Kontrola duplicit při AI generování — **M**
Tlačítko „New Flashcards“, které načte existující sady a vygeneruje slova,
jež se neopakují s těmi, co už uživatel má.
- Stav: hotovo (07/2026). Přepínač „Pouze nová slovíčka“ (výchozí zapnuto)
  v AI formuláři; existující slova jazykové dvojice se posílají do promptu
  (limit 300) a po generování běží normalizovaná deduplikace (velikost
  písmen, diakritika, interpunkce) proti celé slovní zásobě i uvnitř dávky.
  Účtuje se jen skutečně vytvořený počet slov. Navíc endpoint
  `POST /api/words/[id]/regenerate` + tlačítka na zadní straně karty pro
  přegenerování špatného obrázku (80 mincí) nebo překladu (1 mince).

### 3.4 Kvalita obrázků — odstranění zbytkových písmen — **S–M**
Generované obrázky občas obsahují zbytky textu.
- Řešení: úprava promptu pro obrázkový model, případně post-filtr.

---

## P4 – Platforma

### 4.1 iOS Swift aplikace + zablokování webu na mobilu — **XL**
Nativní iOS verze, web omezit pouze na desktop.
- Pozn.: samostatný projekt, mimo rozsah tohoto repozitáře. Web-side část
  (detekce mobilu) je **S**.

---

## Otevřené otázky k rozhodnutí
- Platby (1.3): poskytovatel a cenotvorba.
- Streak/statistiky (3.2): granularita logování a retence dat.
- iOS (4.1): priorita vs. dotažení webu; chceme web na mobilu úplně vypnout?
