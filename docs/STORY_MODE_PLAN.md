# Příběhy DuoCards — produktový a technický plán

> Stav k 2026-07-24: schválený plán, implementace zatím nezačala.

Rozpracování roadmapové položky 2.4 (AI hra: Story-telling s doplňováním).
Cílem jsou dvě podoby jedné funkce nad společným generátorem:

1. **Sólo Příběhy na dashboardu** — osobní učení: AI vygeneruje příběh
   s vynechanými slovy z vybraných sad, uživatel doplňuje, pokračuje dalšími
   kapitolami.
2. **Živý příběh (`story_coop`)** — kooperativní live režim: místnost doplňuje
   jeden příběh společně (viz `LIVE_GAME_PRODUCT_PLAN.md`, kap. 5.18).

Stav k 07/2026: nic z toho neexistuje; existují ale všechny stavební kameny —
tolerantní porovnávání psaných odpovědí, ekonomika AI mincí, poznámky
s tvorbou kartiček, SRS statistiky a self-paced kategorie v registru živých
her.

---

## 1. Proč příběhy

- Kartičky učí slova izolovaně; příběh je ukotví v kontextu, což je
  nejsilnější známý mechanismus pro dlouhodobé zapamatování.
- Příběh je přirozený „spotřebič“ AI mincí s jasnou hodnotou pro uživatele
  (na rozdíl od jednorázového překladu).
- Kapitolové pokračování vytváří návyk: „chci vědět, jak to dopadne“ je
  silnější motivace než streak počítadlo.
- Uzavírá smyčku s existujícími funkcemi: neznámé slovo z příběhu → poznámky
  → „Vytvořit kartičky z poznámek“ (hotovo) → nová sada → další kapitola
  z této sady.

## 2. Sólo Příběhy na dashboardu

### 2.1 Tok uživatele

1. Na dashboardu přibude položka **Příběhy** (vedle balíčků kartiček).
2. Nový příběh: výběr 1–3 sad, žánr (dobrodružný, detektivka, sci-fi,
   pohádka, ze života), délka kapitoly (krátká ~120 slov / střední ~250),
   úroveň CEFR (výchozí odhad podle poměru naučených kartiček), volitelné
   vlastní téma (krátké pole, limit 60 znaků).
3. AI vygeneruje kapitolu: souvislý text v cílovém jazyce s 8–15 dírami.
   Do děr patří slova z vybraných sad (přednostně ta, která mají v SRS
   nejnižší úspěšnost).
4. Uživatel doplňuje. Dva vstupní režimy podle volby:
   - **Výběr z banku** (lehčí): pod textem je slovní banka, slova se
     přetahují/klikají do děr; každé slovo lze použít jednou.
   - **Psaní** (těžší): textové pole v díře, vyhodnocení stejnou tolerantní
     normalizací jako psané odpovědi v live hrách (bez diakritiky, jeden
     překlep u slov od 4 znaků).
5. Vyhodnocení: barevné odlišení správně/špatně, u chyb krátké vysvětlení
   (proč tam patří jiné slovo, tvar/pád). Přesnost kapitoly se uloží.
6. Pokračování: tlačítko „Další kapitola“ — AI naváže na shrnutí předchozí
   kapitoly; uživatel může přepnout sady (roadmap výslovně chce navázání
   s jinými sadami).
7. Neznámé slovo v textu: klik na libovolné slovo → miniaturní překlad
   (1 mince, existující `/api/translate-word`) + tlačítko „Přidat do
   poznámek“. Z poznámek pak vede hotová cesta ke kartičkám.

### 2.2 Pravidla doplňování

- Každá díra má právě jedno správné slovo; generátor musí zaručit, že žádné
  jiné slovo z banku nedává v dané větě smysl (kontrola při validaci
  výstupu, viz 3.3).
- Skloňování/časování: v první verzi se do děr doplňuje tvar uvedený
  v kapitole (generátor smí slovo ohnout a v banku ukáže základní tvar
  s nápovědou tvaru). Hodnotí se tvar z textu s psanou tolerancí.
- Nápověda: první písmeno za 5 % bodů kapitoly, celé slovo odhalí díru bez
  bodů (učení má přednost před trestem).

### 2.3 Kapitoly, seriál a knihovna

- Příběh = seriál kapitol se společným titulem, žánrem a jazykovým párem.
- Každá kapitola končí krátkým shrnutím (generuje AI zároveň s textem);
  shrnutí + 2–3 dějové kotvy se posílají do promptu další kapitoly, aby děj
  navazoval i po týdnech.
- Knihovna příběhů: seznam s obálkou (barevný gradient + žánrová ikona,
  bez generovaných obrázků v MVP), stavem (rozečteno/dokončeno) a přesností.
- Dokončený příběh jde otevřít jako čistý text ke čtení (bez děr) — funguje
  jako vlastní čítanka z probrané slovní zásoby.

### 2.4 Ekonomika AI mincí

Konzistentně s `COIN_COSTS` (FLASHCARD_GENERATION 5, AUDIO 5, IMAGE 80,
WORD_TRANSLATION 1, AI_CHAT 3):

| Akce | Cena (návrh) |
|---|---:|
| Kapitola krátká (~120 slov, 8–10 děr) | 10 mincí |
| Kapitola střední (~250 slov, 12–15 děr) | 18 mincí |
| Přegenerování kapitoly (nelíbí se) | 5 mincí, max 2× na kapitolu |
| Překlad slova z textu | 1 mince (existující) |
| Audio verze kapitoly (TTS předčítání) | +5 mincí, fáze 3 |
| Ilustrace kapitoly | +80 mincí, fáze 3, volitelné |

Odměna: dokončení kapitoly s přesností ≥ 80 % vrátí 3 mince (přes existující
mechaniku `CompletionReward`, s denním stropem, aby se nedala farmit).

### 2.5 Vztah k SRS

- Slova doplněná správně/špatně se propíší do statistik studia jako lehká
  interakce (nižší váha než plnohodnotné opakování kartičky).
- Výběr slov do děr preferuje karty „due“ a karty s nízkou úspěšností —
  příběh se tak stává zábavnou formou opakování naplánovaného obsahu.

## 3. Generátor — technický návrh

### 3.1 Vstup

```json
{
  "fromLanguage": "Czech",
  "toLanguage": "English",
  "cefr": "A2",
  "genre": "detective",
  "lengthWords": 250,
  "words": [{ "word": "vlak", "translation": "train" }],
  "previousSummary": "…",
  "customTopic": "výlet do hor"
}
```

### 3.2 Výstup (strukturovaný JSON, vynucený schématem)

```json
{
  "title": "The Night Train",
  "paragraphs": ["…text s placeholdery {{gap:1}}…"],
  "gaps": [
    {
      "id": 1,
      "answer": "train",
      "baseForm": "train",
      "hint": "dopravní prostředek",
      "explanation": "Ve větě chybí podstatné jméno…",
      "distractors": ["bus", "plane", "ship"]
    }
  ],
  "vocabBank": ["train", "ticket", "…"],
  "summaryForNextChapter": "…",
  "usedWordIds": [12, 31]
}
```

Distraktory se generují rovnou (pro režim výběru z banku a pro live
variantu s možnostmi) a musí pocházet ze slovní zásoby uživatele, nikdy
z cizích soukromých sad.

### 3.3 Validace a bezpečnost

- Schéma validovat serverem; nevalidní odpověď = 1 automatický retry, pak
  chyba bez stržení mincí (mince se strhávají až po úspěšné validaci —
  stejný princip jako u generování kartiček).
- Kontroly: každý `{{gap:n}}` má právě jeden záznam v `gaps`; `answer` je
  z dodaných slov; text neobsahuje `answer` v okolí díry (únik odpovědi);
  délka v tolerančním pásmu ±30 %.
- Obsahová bezpečnost: prompt vynucuje obsah vhodný pro děti (aplikaci
  používají třídy), žádná jména reálných osob, žádné značky; výstup projde
  stejným moderačním filtrem jako AI chat.
- Rate limit: 5 generací / 10 minut / uživatel (nad rámec mincí).

### 3.4 Datový model (návrh Prisma)

```prisma
model Story {
  id           Int            @id @default(autoincrement())
  userId       Int
  title        String
  genre        String         @db.VarChar(30)
  cefr         String         @db.VarChar(5)
  fromLanguage String
  toLanguage   String
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  chapters     StoryChapter[]

  @@index([userId, updatedAt])
  @@map("stories")
}

model StoryChapter {
  id         Int      @id @default(autoincrement())
  storyId    Int
  sequence   Int
  content    Json     // paragraphs + gaps + vocabBank (viz 3.2)
  summary    String   @default("")
  answers    Json?    // odpovědi uživatele { gapId: { value, correct } }
  accuracy   Int?     // 0–100 po dokončení
  coinsSpent Int      @default(0)
  createdAt  DateTime @default(now())
  story      Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@unique([storyId, sequence])
  @@map("story_chapters")
}
```

### 3.5 API (Next.js fallback i Fastify `/api/v1`)

| Endpoint | Účel |
|---|---|
| `POST /api/stories` | založit příběh + vygenerovat 1. kapitolu (strhne mince) |
| `GET /api/stories` | knihovna příběhů uživatele |
| `GET /api/stories/:id` | detail s kapitolami |
| `POST /api/stories/:id/chapters` | další kapitola (strhne mince) |
| `PUT /api/stories/:id/chapters/:seq/answers` | uložit odpovědi, vrátit vyhodnocení + případnou odměnu |
| `POST /api/stories/:id/chapters/:seq/regenerate` | přegenerování (limit 2×) |

Vyhodnocení odpovědí probíhá vždy na serveru (kvůli odměnám v mincích) a
používá stejné funkce tolerantního porovnání jako live psané odpovědi —
kandidát na sdílený modul `contracts/` nebo `src/lib/typedAnswer.ts`
+ kopie v `backend/`.

## 4. Živý příběh (`story_coop`) — live varianta

- **Založení:** host vybere sady, žánr a délku; generaci platí host ze svých
  mincí (cena jako sólo kapitola). Generace proběhne v lobby, start hry až
  po úspěšné validaci.
- **Průběh:** self-paced (kategorie v registru existuje). Každá díra se
  přidělí hráči round-robin; hráč vidí celý text, ale editovat smí jen své
  díry. Kdo je hotov, může převzít neobsazené nebo vzdané díry.
- **Společný cíl:** přesnost místnosti ≥ 80 % (nastavitelné) — vyhrají nebo
  prohrají všichni; žádný osobní žebříček (stejná filozofie jako Společná
  mise).
- **Finále:** příběh se zobrazí celý, díry barevně podle hráčů, projde se
  chybami s vysvětleními. Hostitelská obrazovka na projektor ukazuje text
  doplňovaný v reálném čase.
- **Mapování na engine:** každá díra = jedno kolo (`LiveRound`) s promptem
  „věta s dírou“; `options` = distraktory (režim výběru) nebo prázdné
  (psaní). Přidělení hráči = nový sloupec `assignedParticipantId` na kole.
  Per-hráč kurzor odpovídá plánu self-paced režimů (kap. 7.2 produktového
  plánu).
- **Po hře:** hráči s účtem si mohou příběh uložit do své knihovny
  (vytvoří se `Story` se snapshotem kapitoly).

## 5. UI zásady

- Dashboard: karta „Příběhy“ v levé navigaci; prázdný stav s ukázkou, jak
  příběh vypadá.
- Čtečka: text s dírami jako interaktivními čipy; klávesnicí ovladatelné
  (Tab mezi dírami, Enter potvrzení), `aria-label` s číslem díry a
  nápovědou; plná podpora dark mode.
- Vše přes i18n (`stories.*` sekce v en + cs), žádné texty natvrdo.
- Mobilní web se neřeší (aplikace je desktop-only), ale čtečka musí zvládat
  užší okno kvůli dělenému oknu ve třídě.

## 6. Metriky

- Dokončenost kapitol (cíl ≥ 70 % započatých kapitol dokončeno).
- Podíl příběhů s 2+ kapitolami (návykovost seriálu).
- Přesnost doplnění vs. úspěšnost stejných slov v SRS po 7 dnech
  (ověření, že kontext skutečně pomáhá).
- Mince utracené za příběhy / uživatel / týden.
- U `story_coop`: podíl místností, které splní společný cíl (cílit na
  60–80 % — moc snadné ani moc těžké mise nebaví).

## 7. Fáze dodání

| Fáze | Obsah | Odhad |
|---|---|---|
| F1 | Sólo MVP: generátor + validace, model Story/StoryChapter, čtečka s výběrem z banku, mince, knihovna | L |
| F2 | Psané doplňování (sdílený modul tolerance), kapitolové navazování, propojení s poznámkami a SRS výběrem slov | M |
| F3 | Audio předčítání kapitoly, volitelná ilustrace, odměny za přesnost | M |
| F4 | Live `story_coop` nad self-paced enginem | L |

## 8. Otevřená rozhodnutí

1. Který model generuje (stejný jako AI chat, nebo levnější s vyšším
   retry)? Výchozí: stejný jako generování kartiček.
2. Skloňované tvary v dírách — MVP hodnotí tvar z textu; alternativa
   „uznat základní tvar“ vyžaduje lemmatizaci, odloženo.
3. Sdílení příběhů mezi uživateli (veřejná knihovna příběhů) — mimo rozsah,
   zvážit po F2 podle metrik.
4. Cena kapitol — návrh v 2.4 ověřit proti reálným nákladům na tokeny po
   prvním týdnu provozu.
