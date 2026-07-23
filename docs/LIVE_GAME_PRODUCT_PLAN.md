# DuoCards Live Game 2.0 — produktový a technický plán

> Stav k 2026-07-23 (v1.0.0): produktový plán. Implementováno: engine v2, Classic Arena, Streak Combo, Survival, Team Battle, Risk, Sprint, Maraton, psané odpovědi, historie her, QR pozvánky. Zbytek kapitol 5.x je zásobník nápadů.

> Stav dokumentu: návrh k implementaci
> Poslední aktualizace: 21. 7. 2026
> Vlastník: DuoCards
> Rozsah: webový host, webový hráč, později iOS hráč

## 1. Cíl

Live Game 2.0 má změnit dnešní jednoduchou společnou místnost na přehlednou
platformu s více skutečně odlišnými hrami nad vlastními sadami kartiček.
Učitel nebo host hru vytvoří na počítači, hráči se připojí krátkým kódem nebo
QR kódem a mohou hrát bez účtu. Každý režim musí pořád procvičovat obsah, ne jen
překrývat stejný kvíz jinou grafikou.

Hlavní cíle:

- spuštění hry do 60 sekund bez nutnosti vysvětlovat ovládání;
- výrazně odlišné režimy pro soutěž, spolupráci, rychlost a klidné procvičení;
- fungování ve třídě, mezi přáteli i při vzdáleném hovoru;
- dobře čitelná nabídka i po přidání desítek režimů;
- autoritativní server, spolehlivé obnovení spojení a žádné dvojité body;
- výsledky po otázkách i po hráčích, aby hra měla výukovou hodnotu;
- vlastní vizuální identita DuoCards, nikoli kopie Kahootu nebo Blooketu.

## 2. Co existuje dnes

Aktuální implementace v `src/app/live-game/page.tsx` už umí:

- vytvořit a připojit se do místnosti pomocí kódu;
- Ably presence, počet a seznam připojených hráčů;
- lobby, sdílení nastavení a ukončení relace;
- výběr více sad, délku relace a volitelný moderovaný chat;
- společné procvičování kartiček v režimu `practice`;
- uložit základní záznam hry a účastníky do historie.

Pět současných názvů režimů (`practice`, `classic_duel`, `speed_run`,
`team_battle`, `survival`) zatím není pět hotových her. Mimo `practice` se po
startu převážně zobrazí jen zvolený režim a sady. Body ani správnost odpovědí
nejsou řízené serverem. Místnost také vzniká na klientovi a Ably token nyní
nedává oprávnění jen ke konkrétní místnosti.

Z toho plyne zásadní rozhodnutí: nebudeme postupně doplňovat další podmínky do
jedné velké stránky. Nejprve vznikne sdílený herní engine a konfigurační registr
režimů; jednotlivé hry se na něj budou napojovat jako samostatné moduly.

## 3. Produktové principy

1. **Jedna otázka, jedna jasná akce.** Hráč na mobilu vždy okamžitě pozná, co
   má udělat.
2. **Správnost má přednost před náhodou.** Náhoda může vytvářet napětí, nesmí
   dlouhodobě přebít znalosti.
3. **Režimy se liší pravidly.** Nová barva nebo pozadí není nový herní režim.
4. **Host řídí tempo, pokud to režim vyžaduje.** U samostatně postupujících her
   sleduje dění, ale nezdržuje rychlejší hráče.
5. **Nikdo nezůstane dlouho mimo hru.** Vyřazení hráči dostanou roli diváka,
   tréninkové otázky nebo možnost návratu.
6. **Výsledek je vysvětlitelný.** Na konci jde zobrazit, za co přesně hráč
   získal body a které kartičky potřebuje procvičit.
7. **Oslavy jsou krátké a volitelné.** Zvuk, pohyb i částice lze ztlumit nebo
   vypnout; respektuje se `prefers-reduced-motion`.
8. **Hostitel nemusí být technik.** Doporučená nastavení budou předvyplněná a
   pokročilé volby schované v rozbalovací části.

## 4. Informační architektura a nový vzhled

### 4.1 Vstupní Live Hub

Dnešní formulář nahradí samostatná domovská obrazovka živých her:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Živé hry                          [Historie] [Jak to funguje]     │
│                                                                  │
│ [ + Vytvořit hru ]       [ Kód místnosti ______ ] [ Připojit ]   │
│                                                                  │
│ Pokračovat / nedávno hrané                                        │
│ [Klasická aréna] [Týmový střet] [Výprava za pokladem]            │
│                                                                  │
│ Objevit režimy       [Vše] [Rychlé] [Týmy] [Strategie] [Studium] │
│ [karta režimu] [karta režimu] [karta režimu]                     │
└──────────────────────────────────────────────────────────────────┘
```

Každá karta režimu ukáže bez otevření detailu:

- název, originální emblém a jednu větu s cílem hry;
- štítky `synchronní` / `vlastní tempo`, počet hráčů a doporučený čas;
- zaměření: rychlost, přesnost, paměť, týmová spolupráce nebo strategie;
- stav `Novinka`, `Doporučeno`, `Beta` nebo `Brzy`;
- tlačítko **Hrát** a odkaz **Pravidla**.

Při větším počtu režimů se použijí kategorie, vyhledávání, oblíbené a naposledy
hrané. Nebude vznikat nekonečný nečleněný seznam ani carousel jako jediný způsob
navigace. Na mobilu budou hlavní akce nahoře a karty v jednom sloupci.

### 4.2 Průvodce vytvořením hry

Vytvoření bude mít čtyři krátké kroky se souhrnem vpravo:

1. **Režim** — výběr a stručné porovnání pravidel.
2. **Obsah** — jedna či více sad, odstranění duplicit, náhled počtu použitelných
   kartiček a směr otázky.
3. **Pravidla** — délka/počet kol, týmy, čas na odpověď, náhodné pořadí,
   pozdní připojení a přístupnost.
4. **Lobby** — kód, QR, seznam hráčů, kontrola obsahu a tlačítko Start.

Systém před startem upozorní například na málo kartiček pro zvolenou délku,
chybějící překlady nebo režim nevhodný pro počet hráčů.

### 4.3 Tři odlišná rozhraní

- **Obrazovka hosta:** velký kód/QR v lobby, průběh hry, ovládání tempa,
  leaderboard a moderace. Je navržena pro projektor 16:9.
- **Obrazovka hráče:** minimum textu, velké dotykové cíle a vždy dostupný stav
  spojení. Je navržena mobile-first; odpověď nesmí vyžadovat sledování hostova
  projektoru, pokud host povolí zobrazování otázky na zařízení.
- **Veřejná obrazovka:** volitelný read-only odkaz pro projektor. Host tak může
  ovládat hru z notebooku bez odhalení administrátorských tlačítek.

## 5. Herní režimy

### Přehled

| Režim | Tempo | Hlavní dovednost | Ideálně | Délka | Vydání |
|---|---|---|---:|---:|---|
| Klasická aréna | synchronní | rychlost + správnost | 2–100 | 8–15 min | hotovo (07/2026) |
| Streak Combo | synchronní | série správných odpovědí | 2–100 | 8–15 min | hotovo (07/2026) |
| Survival | synchronní | přesnost pod tlakem | 3–100 | 8–15 min | hotovo (07/2026) |
| Týmová bitva | synchronní | týmová spolupráce | 4–100 | 10–20 min | hotovo (07/2026), první iterace Týmového střetu |
| Sázkový mód (Risk) | synchronní | odhad vlastní jistoty | 2–100 | 8–15 min | hotovo (07/2026) |
| Přesnost | synchronní | správnost bez stresu z rychlosti | 1–100 | 8–15 min | MVP (engine hotový, zatím není v nabídce) |
| Společná mise | vlastní tempo, společný cíl | spolupráce + opakování | 1–100 | 5–20 min | MVP (engine hotový, zatím není v nabídce) |
| Rychlá série | vlastní tempo | vybavení z paměti + rychlost | 1–100 | 3–10 min | v2 |
| Poslední karta | synchronní | přesnost pod tlakem, tři životy | 3–50 | 8–15 min | v2 |
| Lingo | synchronní | skladba slova, pravopis | 1–100 | 8–15 min | v2 |
| Riskuj! (tabule) | synchronní, tahové | strategický výběr + znalosti | 2–50 | 15–25 min | v2–v3 |
| Aukce otázek | synchronní | hospodaření s body + sebedůvěra | 3–50 | 10–20 min | v3 |
| Štafeta | synchronní, tahové | zapojení celého týmu | 4–40 | 10–20 min | v3 |
| Bingo slovíček | synchronní | poslech/čtení + pozornost | 2–100 | 8–15 min | v3 |
| Diktát | synchronní | poslech + pravopis | 1–100 | 8–15 min | v3 (vyžaduje audio na kartách) |
| Pexeso živě | tahové | paměť + párování | 2–12 | 8–15 min | v3 |
| Závod s duchem | vlastní tempo | zlepšení proti minulému výkonu | 1–100 | 5–15 min | v3 |
| Výprava za pokladem | vlastní tempo | znalosti + lehká strategie | 2–100 | 10–20 min | v3 |
| Turnajový pavouk | synchronní, duely | opakované krátké souboje | 4–32 | 15–30 min | v4 |
| Maraton (domácí úkol) | vlastní tempo, dny | vytrvalost + samostatnost | 1–100 | hodiny–dny | v4 |
| Živý příběh | vlastní tempo, společný cíl | kontext + tvorba | 2–40 | 15–25 min | v4, viz `STORY_MODE_PLAN.md` |

Poznámka (07/2026): napříč režimy je hotová volba **psaných odpovědí** —
hráč překlad píše, server toleruje chybějící diakritiku a jeden překlep
(viz kapitola 6). Sázková mechanika (bank, sázka, výplata dvojnásobku) a
týmová mechanika (výběr týmu v lobby, průměr na hráče) jsou v enginu a lze
na nich stavět režimy níže.

Limity jsou doporučené produktové hodnoty, ne slib škálování. Skutečné maximum
se nastaví až podle zátěžových testů.

### 5.1 Klasická aréna (`classic_arena`)

Nejbližší režim klasickému živému kvízu. Všichni dostanou stejnou otázku ve
stejnou chvíli. Po odpovědi následuje krátké vyhodnocení a po několika otázkách
pořadí.

- **Cíl:** získat nejvíce bodů za správné a včasné odpovědi.
- **Bodování:** základ za správnost + omezený bonus za rychlost + malý bonus za
  sérii. Rychlost nikdy nezachrání špatnou odpověď.
- **Chybná odpověď:** 0 bodů, okamžitá drobná zpětná vazba; správná odpověď se
  ukáže až ve fázi vyhodnocení.
- **Rytmus:** odpočet → otázka → uzamčení → správná odpověď a distribuce →
  pohyb v pořadí → další otázka → pódium.
- **Odlišnost:** společný dramatický rytmus a viditelné změny pořadí.
- **Host:** může pozastavit, přeskočit vadnou otázku a ručně přejít dál.

### 5.2 Přesnost (`accuracy`)

Klidnější synchronní kvíz. Čas slouží jen jako limit, nikoli jako zdroj bodů.
Je vhodný pro nový obsah, různou rychlost čtení a přístupnější výuku.

- **Cíl:** nejvyšší procento správných odpovědí.
- **Bodování:** stejný počet bodů za každou správnou odpověď; remízu rozhodne
  nejdelší série, případně společné umístění.
- **Chybná odpověď:** bez penalizace rychlostí, po kole vysvětlení.
- **Odlišnost:** odstraňuje tlak na rychlost; žebříček lze skrýt až do konce.
- **Volba hosta:** individuální sebedůvěra po odpovědi (`jistě / nejistě`) pro
  pozdější report, bez vlivu na skóre.

### 5.3 Společná mise (`co_op_mission`)

Všichni postupují vlastním tempem, ale plní jeden společný cíl. Není zde osobní
žebříček, takže režim funguje i pro procvičování bez soutěžního stresu.

- **Cíl:** společně nabít „jádro znalostí“ správnými odpověďmi před vypršením
  času nebo dosáhnout cílové přesnosti.
- **Bodování:** týmový postup; osobní příspěvek vidí jen konkrétní hráč a host.
- **Chybná odpověď:** krátké vysvětlení a pozdější opakování stejné kartičky.
- **Odlišnost:** kooperace a adaptivní opakování, žádný veřejný poslední hráč.
- **Host obrazovka:** animovaná společná mapa/konstelace, nikoli leaderboard.

### 5.4 Rychlá série (`speed_streak`)

Krátká samostatně postupující hra s vysokou frekvencí otázek. Každý hráč má
vlastní pořadí, server však zajistí srovnatelnou obtížnost.

- **Cíl:** nasbírat za pevný čas co nejvíce správných odpovědí.
- **Bodování:** správná odpověď = bod; série dočasně zvyšuje násobič, chyba ho
  sníží, ale neodebírá již získané body.
- **Odlišnost:** nepřerušovaný flow bez čekání na nejpomalejšího hráče.
- **Férovost:** každý dostane stejný počet typů/obtížností, ne nutně stejné
  pořadí. Limit rychlého klikání zabrání náhodnému spamování.

### 5.5 Týmový střet (`team_clash`)

Dva až osm barevně i ikonou odlišených týmů. Hráč odpovídá sám, ale přispívá
ke společnému výsledku.

- **Cíl:** získat nejvyšší týmové skóre.
- **Bodování:** průměr správnosti týmu + body za odpovědi; velikost týmu nesmí
  automaticky rozhodnout. Individuální rychlost má jen malý bonus.
- **Týmy:** náhodné rozdělení, ruční přesun hráče, přejmenování a vyvážení před
  startem. Barva je vždy doplněna ikonou a názvem.
- **Týmové schopnosti:** po několika správných odpovědích může tým hlasovat pro
  jedno použití nápovědy nebo ochrany série. Nejde útočit na konkrétní dítě.
- **Odlišnost:** komunikace, společné rozhodnutí a dvojí report — tým i hráč.

### 5.6 Poslední karta (`last_card`)

Survival varianta, která hráče netrestá okamžitým definitivním vyřazením.

- **Cíl:** udržet si alespoň jedno ze tří srdcí až do finále.
- **Chybná odpověď:** ztráta srdce. Hráč bez srdcí přejde do tréninkového kola,
  kde může třemi správnými odpověďmi získat jeden návrat.
- **Bodování:** přežitá kola + správnost; rychlost pouze při remíze.
- **Odlišnost:** napětí z omezených životů, ale stále aktivní učení po chybě.
- **Bezpečí:** host může návraty vypnout nebo zvolit anonymní pořadí.

### 5.7 Výprava za pokladem (`treasure_expedition`)

První charakteristický strategický režim DuoCards. Správné odpovědi dávají
energii k postupu přes krátkou mapu; hráč si mezi bezpečnou a riskantní cestou
volí sám.

- **Cíl:** do konce expedice získat nejvíce artefaktů.
- **Smyčka:** odpověď → energie → volba jedné ze dvou cest → okamžitý efekt →
  další otázka.
- **Strategie:** bezpečná cesta má jistý malý zisk, riskantní vyšší možný zisk
  i prázdné políčko. Znalosti určují počet voleb, náhoda jen jejich hodnotu.
- **Ochrana férovosti:** celkový náhodný bonus je omezený a na konci je vidět
  skóre ze znalostí odděleně od bonusu z mapy.
- **Odlišnost:** vlastní tempo a jednoduché strategické rozhodnutí bez přímého
  ničení postupu ostatních.
- **Vydání:** až po stabilizaci základního enginu; vyžaduje vlastní grafiku a
  simulace vyvážení.

### 5.8 Lingo (`lingo`)

Slovní hádanka po vzoru Wordle/Lingo postavená přímo na psaných odpovědích.
Hráči hádají překlad zadaného slova; po každém pokusu se písmena obarví
(správně na místě / správně jinde / mimo). Nejlepší poměr efekt/pracnost
z celého katalogu.

- **Cíl:** uhodnout překlad na co nejméně pokusů.
- **Smyčka:** otázka (výraz + počet písmen) → až 5 psaných pokusů → barevná
  zpětná vazba po písmenech → vyhodnocení → další slovo.
- **Bodování:** 1 000 − 150 × (pokusy − 1); neuhodnuté slovo 0 bodů. Rychlost
  nehraje roli, jen počet pokusů.
- **Chybná odpověď:** pokus se spotřebuje, nápověda barvami zůstává vidět.
- **Stavební kameny:** normalizace diakritiky a psané odpovědi (hotovo),
  stavový automat beze změny; nový je jen výpočet obarvení a UI mřížka.
- **Engine:** porovnání po znacích nad `normalizeAnswerLoose`; více pokusů na
  kolo = nová tabulka pokusů, nebo limit pokusů uložený v `LiveAnswer`.
- **Pracnost:** S–M. **Vydání:** v2.

### 5.9 Riskuj! (`quiz_board`)

Tabule 5×N: sloupce podle štítků nebo sad, řádky podle bodové hodnoty
100–500. Hráči (nebo týmy) se střídají ve výběru políčka. Vyšší hodnota =
delší/těžší slovo. Ideální na projektor ve třídě — charakteristický režim,
který běžné kvízové aplikace nemají.

- **Cíl:** nasbírat z tabule nejvíce bodů.
- **Smyčka:** hráč na tahu vybere políčko → otázku vidí všichni a odpovídají
  všichni (vybírající za dvojnásobek) → vyhodnocení → tabule se odkryje.
- **Skrytá políčka:** 2–3 „Sázka!“ políčka — vybírající vsadí část banku
  (mechanika `risk_bet` beze změny).
- **Bodování:** hodnota políčka; ostatní hráči polovinu. Špatná odpověď
  vybírajícího odečte polovinu hodnoty (motivace vybírat s rozmyslem).
- **Stavební kameny:** sázky a bank (hotovo), štítky sad (hotovo), REVEAL
  rytmus (hotovo).
- **Engine:** kola se negenerují lineárně, ale jako mřížka s metadaty
  (kategorie, hodnota, stav); nový příznak „kdo je na tahu“.
- **Pracnost:** M. **Vydání:** v2–v3.

### 5.10 Aukce otázek (`auction_quiz`)

Před každou otázkou proběhne krátká dražba z banku bodů. Vítěz dražby
odpovídá sám: správně bere dvojnásobek nabídky, špatně ji ztrácí a otázka
se za polovinu nabídne druhému v pořadí. Učí hospodařit s body a odhadovat
vlastní jistotu.

- **Cíl:** mít na konci nejvyšší bank.
- **Smyčka:** náhled kategorie otázky → 10s dražba (posuvník jako u sázek)
  → otázka pro vítěze → případná přeprodej → vyhodnocení.
- **Bodování:** pouze pohyby banku; každý startuje s 1 000 body
  (konstanta `RISK_BET_STARTING_BANK`).
- **Chybná odpověď:** ztráta nabídky; otázka putuje dál, takže se třída
  učí i z cizích chyb.
- **Stavební kameny:** bank a sázky (hotovo), posuvník sázky (hotovo).
- **Engine:** nová krátká fáze BIDDING před QUESTION — první rozšíření
  stavového automatu; dražbu lze v první verzi zjednodušit na „zapečetěné
  obálky“ (každý pošle nabídku jednou, bez přihazování).
- **Pracnost:** M–L. **Vydání:** v3.

### 5.11 Štafeta (`relay`)

Týmová hra, ve které tým odpovídá postupně — vždy jen jeden hráč „drží
kolík“. Správná odpověď posune tým o políčko a předá kolík dalšímu; chyba
vrací tým o políčko zpět. Na rozdíl od průměru v Týmové bitvě se nikdo
neschová: na každém článku záleží.

- **Cíl:** doběhnout štafetovou trať (např. 20 políček) jako první, nebo
  být po vypršení času nejdál.
- **Smyčka:** otázka pro držitele kolíku (ostatní ji vidí, ale neodpovídají)
  → vyhodnocení → posun na trati → kolík dalšímu v pořadí.
- **Bodování:** pozice na trati; individuální statistiky se ukládají pro
  report, ale nerozhodují.
- **Chybná odpověď:** −1 políčko a kolík se předává dál — chyba nikoho
  nevyřazuje, jen zpomalí tým.
- **Stavební kameny:** týmy (hotovo), pořadí hráčů z lobby.
- **Engine:** ukazatel „kdo je na tahu“ per tým + pozice týmů; otázky se
  přidělují jednotlivci místo všem.
- **Pracnost:** M. **Vydání:** v3.

### 5.12 Bingo slovíček (`word_bingo`)

Každý hráč dostane kartu 4×4 s překlady namíchanými z vybraných sad. Host
(nebo server) postupně „vyvolává“ výrazy; hráč označí odpovídající překlad
na své kartě. Vyhrává první úplná řada, plný dům ukončuje hru.

- **Cíl:** první dokončená řada / sloupec / diagonála.
- **Smyčka:** vyvolání výrazu (text, později audio) → 10 s na označení →
  server potvrdí správnost označení → další výraz.
- **Bodování:** řada = velké body, správné jednotlivé označení = malé body,
  falešné označení krátká blokace karty (anti-spam).
- **Stavební kameny:** generátor otázek (hotovo), audio karet pro čtenou
  variantu (existující TTS).
- **Engine:** místo shodné otázky pro všechny má každý hráč vlastní kartu
  (matice), server validuje označení proti vyvolanému slovu.
- **Pracnost:** M. **Vydání:** v3.

### 5.13 Diktát (`dictation`)

Poslechová hra pro sady s audio nahrávkami: přehraje se výslovnost, hráči
píší, co slyšeli (nebo překlad slyšeného — volba hosta). Psané odpovědi
s tolerancí překlepů jsou hotové, takže jde primárně o práci se zvukem.

- **Cíl:** nejvíce správně zapsaných slov.
- **Smyčka:** přehrání audia (2× s odstupem) → psaní → uzamčení →
  zobrazení správného tvaru s výslovností.
- **Bodování:** jako Přesnost (rychlost nerozhoduje); varianta „přísný
  diktát“ bez tolerance překlepů pro pokročilé.
- **Stavební kameny:** psané odpovědi (hotovo), audio karet (hotovo),
  přehrávač už existuje ve studiu kartiček.
- **Engine:** otázka typu audio → text z kapitoly 6; kontrola, že vybrané
  sady mají audio, jinak režim nenabízet.
- **Pracnost:** M. **Vydání:** v3.

### 5.14 Pexeso živě (`memory_pairs`)

Tahová hra pro menší skupiny: společná mřížka zakrytých karet, polovina
výrazy, polovina překlady. Hráči se střídají v otáčení dvojic. Nalezený pár
zůstává hráči; klasická pexesová paměť plus jazykové párování.

- **Cíl:** nasbírat nejvíce párů.
- **Smyčka:** hráč na tahu otočí dvě karty (všichni je vidí) → pár zůstává
  a hráč pokračuje, nepár se zakryje a hraje další.
- **Bodování:** 1 pár = 1 bod; volitelný bonusový bod za vyslovení/napsání
  překladu při otočení (potvrzení, že nejde jen o polohovou paměť).
- **Stavební kameny:** slovní páry ze sad (hotovo), tahové pořadí z lobby.
- **Engine:** sdílený stav mřížky + „kdo je na tahu“; jednodušší než kvízový
  automat, ale jiný datový tvar kola.
- **Pracnost:** M. **Vydání:** v3; doporučeno max ~12 hráčů.

### 5.15 Závod s duchem (`ghost_race`)

Hráč nebo třída závodí proti „duchovi“ — uloženému průběhu dřívější hry ze
stejné sady (vlastní minulý výkon, nejlepší výkon třídy, výkon hostitele).
Unikátní propojení s už hotovou historií živých her: nikdo jiný nemá
soutěž „porazíš sám sebe z minulého týdne?“.

- **Cíl:** být v cíli dřív / s vyšším skóre než duch.
- **Smyčka:** vlastní tempo jako Rychlá série; vedle postupu hráče běží
  časová osa ducha (odkud se bere skóre po sekundách).
- **Bodování:** standardní skóre + bonus za poražení ducha.
- **Stavební kameny:** ukládání výsledků her (hotovo — `LiveGame` +
  `LiveGamePlayer`); je potřeba začít ukládat i časový průběh (skóre po
  kolech), ne jen konečný stav.
- **Engine:** kategorie self-paced z registru; duch je jen datová stopa,
  žádná synchronizace mezi hráči.
- **Pracnost:** M (z toho polovina je rozšíření ukládání historie).
  **Vydání:** v3.

### 5.16 Turnajový pavouk (`tournament`)

Série krátkých duelů 1v1 (3–5 otázek) v klasickém pavouku. Kdo prohraje,
nevypadává z aplikace — přesune se do „util. větve“ o umístění, takže hrají
všichni pořád. Diváci vidí pavouka a fandí.

- **Cíl:** vyhrát pavouka; vedlejší větev hraje o konečné pořadí.
- **Smyčka:** rozlosování → kolo duelů běžících paralelně → postupy →
  finále na společné obrazovce.
- **Bodování:** v duelu jako Klasická aréna; do pavouka jde jen výhra.
- **Stavební kameny:** kvízový automat (hotovo) použitý na dvojici hráčů;
  více „mini-sessions“ pod jednou střechou.
- **Engine:** orchestrace více současných kol nad jednou místností —
  největší zásah z katalogu, proto v4.
- **Pracnost:** L. **Vydání:** v4.

### 5.17 Maraton — domácí úkol (`marathon`)

Místnost otevřená hodiny až dny. Hráči se připojují kdykoli, hrají vlastním
tempem svou porci otázek a žebříček se průběžně ukládá. Učitel ráno zadá,
večer vyhodnotí; navazuje na hotové ukládání výsledků.

- **Cíl:** splnit porci otázek (např. 30) s co nejlepší přesností do
  uzávěrky.
- **Bodování:** přesnost především, rychlost vůbec; volitelně bonus za
  dokončení v první polovině lhůty.
- **Stavební kameny:** self-paced kurzor, prodloužená expirace místnosti,
  průběžný zápis do historie (hotovo v základu).
- **Engine:** změna expirací a životního cyklu místnosti (dnes 6 hodin);
  opakované připojení stejného hráče ke stejné identitě.
- **Pracnost:** M–L. **Vydání:** v4.

### 5.18 Živý příběh (`story_coop`)

Kooperativní vyprávění: AI vygeneruje příběh s vynechanými slovy z vybraných
sad, každý hráč dostane přidělené své díry a místnost příběh společně
dokončuje. Na konci se celý příběh přečte se zvýrazněnými příspěvky hráčů.
Detailní produktový a technický plán včetně sólové verze pro dashboard je
v samostatném dokumentu [`STORY_MODE_PLAN.md`](STORY_MODE_PLAN.md).

- **Cíl:** společná přesnost (např. 80 %) — vyhrají nebo prohrají všichni.
- **Stavební kameny:** psané odpovědi (hotovo), společný cíl ze Společné
  mise, AI generace hrazená mincemi hostitele.
- **Pracnost:** L (sdílená se sólovou verzí). **Vydání:** v4.

## 6. Typy otázek

První verze enginu má podporovat jednotný datový model pro:

- výběr jedné ze 2–4 odpovědí;
- napsání přesného překladu s bezpečnou normalizací diakritiky a mezer;
- otočenou otázku (překlad → výraz);
- pravda/nepravda;
- seřazení písmen nebo částí věty (po MVP);
- audio → text a obrázek → výraz, jen pokud karta potřebná média obsahuje.

Host zvolí povolené typy, výchozí volba bude `automaticky podle obsahu`.
Generátor distraktorů nesmí zveřejnit cizí soukromé sady a před startem musí jít
náhledově zkontrolovat. Překlepy a alternativní správné odpovědi se budou řídit
explicitními pravidly, ne nahodilým AI rozhodnutím během živé hry.

## 7. Průběh relace

### 7.1 Lobby

- Server vytvoří místnost a krátký kód s expirací.
- Host dostane QR a sdílecí odkaz; hostovský tajný token není součástí odkazu.
- Host vidí připojení, duplicity jmen, stav spojení a připravenost.
- Hráč si může zvolit přezdívku a později originální DuoCards avatar.
- Připojení bez účtu je výchozí; účet je potřeba pro hostování a trvalé osobní
  statistiky.
- Host může zamknout lobby, odstranit hráče, zapnout automatická jména a určit,
  zda je povolen pozdní vstup.

### 7.2 Hra

Synchronní režimy používají stavový automat:

```text
LOBBY → COUNTDOWN → QUESTION → LOCKED → REVEAL → SCOREBOARD
                  ↑                                  │
                  └──────────── další kolo ──────────┘
                                      ↓
                              PODIUM → FINISHED
```

Samostatně postupující režimy mají společný `RUNNING` stav, ale každý hráč
vlastní bezpečně uložený kurzor otázky. Server odesílá čas, pořadové číslo
události a snapshot; klient pouze vykresluje a posílá záměr hráče.

### 7.3 Konec a report

Po skončení se zobrazí krátké pódium nebo dokončení společného cíle. Následuje
report:

- celková přesnost, správné/špatné odpovědi a vývoj skóre;
- otázky s nejvyšší chybovostí;
- detail hráče a týmů;
- kartičky doporučené k dalšímu procvičení;
- export CSV a opakování stejné hry;
- soukromé výsledky jednotlivce nejsou bez nastavení promítány celé třídě.

## 8. Herní engine a architektura

### 8.1 Rozdělení odpovědností

```text
Host / Player UI
      │ HTTPS příkazy + realtime události
      ▼
Live Game API (autoritativní pravidla a validace)
      ├── PostgreSQL: místnosti, kola, odpovědi, reporty
      ├── Redis: aktivní stav, zámky, časovače, idempotence
      └── Ably: doručení událostí, presence a snapshot notifikace
```

Ably zůstane transportní vrstva, ne zdroj pravdy. Body, správnost, aktivní
otázka, čas i oprávnění hosta budou rozhodované backendem. Klient nesmí moci
publikovat událost typu `score-changed` nebo si načíst správnou odpověď před
uzamčením kola.

### 8.2 Registr režimů

Každý režim bude definován konfigurací a samostatnou serverovou strategií:

```ts
type GameDefinition = {
  id: string;
  version: number;
  pacing: "synchronized" | "self-paced";
  minPlayers: number;
  recommendedPlayers: [number, number];
  settingsSchema: unknown;
  scoringStrategy: string;
  roundStrategy: string;
  presentation: {
    category: "quick" | "team" | "strategy" | "study";
    icon: string;
    accent: string;
  };
};
```

UI si seznam načte z registru. Přidání režimu tak nevyžaduje přepis hlavního
hubu. Každá uložená hra nese `modeId` a `modeVersion`, aby se starší reporty
nezměnily po pozdějším vyvážení bodů.

### 8.3 Realtime kontrakt

Každá událost ponese minimálně:

- `sessionId`, `eventId`, `sequence`, `serverTime` a `type`;
- bezpečný veřejný payload bez předčasné správné odpovědi;
- verzi kontraktu pro web a budoucí iOS aplikaci.

Příkazy (`join`, `start`, `submitAnswer`, `advanceRound`, `leave`) budou
idempotentní. Po výpadku klient pošle poslední známé `sequence`, načte snapshot
a doplní chybějící události. Odpověď bude přijata nejvýše jednou pro daného
hráče a kolo.

### 8.4 Navržená data

Stávající `LiveGame` a `LiveGamePlayer` je potřeba rozšířit nebo nahradit těmito
koncepty:

- `LiveSession`: host, kód, mode/version, stav, nastavení, start/konec;
- `LiveParticipant`: stabilní hráčský token, jméno, tým, připojení, skóre;
- `LiveRound`: otázka, pořadí, bezpečný snapshot, časování a správná odpověď;
- `LiveAnswer`: účastník, odpověď, latence, správnost, body, unikátní klíč;
- `LiveScoreEvent`: auditovatelná změna bodů a důvod;
- `LiveTeam`: název, ikona, členové a skóre;
- volitelný `LiveEvent`: krátkodobý event log pro obnovu a diagnostiku.

Smazání sady po odehrání nesmí rozbít report, proto relace uloží minimální
snapshot použité otázky. Citlivé odpovědi a IP adresy nebudou uchovávány déle,
než je potřeba.

### 8.5 Bezpečnost a moderace

- token Ably omezit na konkrétní kanál a povolené operace;
- oddělit host token od hráčského tokenu a rotovat je při opětovném připojení;
- serverově ověřovat stav kola, čas, členství a jednu odpověď na hráče;
- rate limit pro vytvoření místnosti, join, odpovědi a chat;
- filtr přezdívek a chatu, automatická jména jako bezpečná volba;
- audit hostovských zásahů a možnost okamžitě uzamknout místnost;
- žádné API klíče, správné odpovědi ani jiné soukromé sady v klientském bundle;
- pravidla ochrany údajů pro školní použití a nastavitelná retence reportů.

### 8.6 Rozdělení mezi repozitáře a nasazení

- **`duocards` (tento web):** Live Hub, průvodce, lobby, host/player/projector
  obrazovky, sdílené TypeScript typy klienta a statické grafické/zvukové assety.
- **`duocards-backend`:** vytvoření a řízení místnosti, odpovědi, skórování,
  snapshoty, reporty, oprávnění Ably, Redis a databázové migrace.
- **`duocards-ios`:** po ustálení kontraktu nativní hráčské obrazovky a obnova
  relace; nebude obsahovat vlastní kopii pravidel bodování.

Vercel fallback může před vytvořením relace převzít požadavek, pokud je sdílený
backend nedostupný, ale konkrétní `sessionId` se po startu připne k jednomu
autoritativnímu backendu. Aktivní hra nesmí střídavě zapisovat do Cloud Run a
Vercelu, protože by vznikla dvě skóre a dvě časové osy. Obě nasazení proto musí
používat kompatibilní verzi realtime kontraktu; klient při nesouladu zobrazí
bezpečnou výzvu k obnovení, ne tichý přechod.

Vývoj proběhne za feature flagem `liveGameV2`. Nejdřív bude dostupný interním
účtům, potom malému procentu hostitelů a až po vyhodnocení reconnectu, latence a
reportů nahradí současnou stránku. Staré uložené historie zůstanou čitelné.

## 9. Vizuální směr a speciální grafika

Pracovní vizuální motiv je **Cesta znalostí**: kartičky se při správných
odpovědích mění v energii, která rozsvěcí mapu jazykových světů. Motiv propojí
režimy, ale každý dostane vlastní siluetu a akcent.

### 9.1 Design systém

- tmavě inkoustové pozadí pro hosta/projektor, světlý i tmavý motiv pro hráče;
- výrazné, ale ne neonově přeplněné akcenty: modrá, tyrkysová, jantarová,
  fialová a korálová;
- režim není rozlišen jen barvou — vždy má unikátní emblém, název a vzor;
- velké číslice, vysoký kontrast, minimální text během kola;
- odpovědi jako 2–4 velké plochy s ikonou i textem, ne kopie barevných tvarů
  jiné značky;
- jednotné komponenty pro timer, sérii, pořadí, spojení a výsledek.

### 9.2 Originální grafické balíčky

- SVG emblém pro každý režim;
- 4–6 abstraktních „společníků znalostí“ nebo avatarových masek navržených
  přímo pro DuoCards, bez převzetí Blooket postaviček;
- vrstvená mapa a artefakty pro Výpravu za pokladem;
- částice kolem skóre, světelné stopy kartiček a krátká animace pódia;
- jednoduché sezónní kulisy až po dokončení základního balíčku.

Grafika rozhraní a emblémy mají být SVG. Krátké oslavy mohou být CSS/Lottie;
Canvas/WebGL se použije jen pro scénu, kde přinese měřitelný efekt. Animace
odpovědi má trvat přibližně 180–300 ms, změna kola 350–500 ms a nesmí blokovat
ovládání.

### 9.3 Zvuk a přístupnost

- vlastní krátký zvuk startu, posledních sekund, správně/chybně a vítězství;
- společný hudební podkres jen v lobby a strategickém režimu;
- samostatné přepínače hudby a efektů, výchozí rozumná hlasitost;
- titulky/vizuální alternativa ke každému zvukovému signálu;
- režim omezeného pohybu, vysoký kontrast, ovládání klávesnicí a správné ARIA;
- barvoslepě bezpečné kombinace a ikona vedle každé týmové barvy.

## 10. Nastavení hosta

### Základní

- sady a směr otázky;
- délka nebo počet kol;
- zobrazit otázku a odpovědi na hráčově zařízení;
- automaticky pokračovat / pokračovat ručně;
- pozdní připojení;
- náhodné pořadí otázek a odpovědí;
- viditelnost průběžného leaderboardu.

### Pokročilé

- čas na otázku, tolerance překlepů a opakování chybných kartiček;
- automatická jména, chat a reakce;
- hudba, zvukové efekty a téma;
- vysoký kontrast a omezený pohyb jako vynucené nastavení místnosti;
- týmy, počet životů nebo strategická pravidla podle režimu;
- soukromé výsledky a retence reportu.

Nastavení, které daný režim nepoužívá, se vůbec nezobrazí. Každý režim bude mít
jedno doporučené přednastavení a nejvýše tři smysluplné varianty, aby průvodce
nepůsobil jako administrace serveru.

## 11. Chování při problémech

- **Hráč ztratí spojení:** zobrazí se offline stav, poslední snapshot zůstane na
  obrazovce a po návratu se hráč připojí pod stejným tokenem a skóre.
- **Host ztratí spojení:** hra se na krátkou dobu pozastaví. Host se může vrátit;
  později lze přidat předem určeného spoluhostitele.
- **Cloud Run se probouzí:** vytvoření hry ukáže stav přípravy; health check lze
  zahřát před lobby. Aktivní hra nesmí přepínat mezi dvěma autoritativními
  backendy uprostřed relace.
- **Ably má výpadek:** příkazy zůstanou přes HTTPS, klient zkusí obnovu a načte
  snapshot. Bez potvrzeného spojení se neukáže falešně odeslaná odpověď.
- **Duplicitní jméno:** UI doplní rozlišovací symbol, identita se řídí tokenem,
  nikoli textem jména.
- **Málo obsahu:** engine řízeně opakuje kartičky až po průchodu sadou a v
  reportu opakování odliší.

## 12. Implementační plán

### Fáze 0 — stabilizace prototypu

- rozdělit `src/app/live-game/page.tsx` na Live Hub, Create Wizard, Lobby,
  Host Screen a Player Screen;
- odstranit duplicitní/klientský stav a zavést typovaný realtime kontrakt;
- vytvořit serverovou místnost, bezpečné role a room-scoped Ably tokeny;
- přidat reconnect snapshot, idempotentní příkazy a základní telemetry;
- migrovat současnou historii na verze režimu a snapshot nastavení.

**Hotovo znamená:** dvě okna odehrají testovací kolo, refresh hráče zachová
identitu a server odmítne druhou odpověď i nepovolený hostovský příkaz.

### Fáze 1 — nový hub a první plnohodnotné hry

- nový katalog režimů, průvodce, lobby s QR a projektorová obrazovka;
- sdílené question/reveal/scoreboard komponenty;
- Klasická aréna, Přesnost a Společná mise;
- základní závěrečný report a zopakování hry;
- přístupnost, vypnutí zvuku/pohybu a čeština + angličtina.

**Hotovo znamená:** host bez instrukcí založí hru, 20 simulovaných hráčů ji
dokončí a součet reportu přesně odpovídá přijatým odpovědím.

### Fáze 2 — tempo a týmy

- Rychlá série, Týmový střet a Poslední karta;
- správa týmů, návrat do hry, adaptivní pořadí a detailní reporty;
- moderace jmen, pozdní vstup, uzamčení lobby a předčasné ukončení;
- zátěžové a chaos testy reconnectu.

**Hotovo znamená:** režimy mají rozdílné serverové strategie, vyvážené bodování
a tým o pěti hráčích nemá výhodu jen proti týmu o čtyřech.

### Fáze 3 — charakteristická hra DuoCards

- prototyp a matematická simulace Výpravy za pokladem;
- vlastní mapa, emblémy, artefakty, zvuk a animace;
- oddělené skóre znalostí a strategického bonusu;
- A/B test délky kola a síly náhody.

**Hotovo znamená:** nejlepší znalostní výkon ve velké většině simulací porazí
slabý výkon s náhodným štěstím a hráči rozumějí volbě bez tutorialu delšího než
30 sekund.

### Fáze 4 — škálování a iOS

- produkční load test a nastavení reálných limitů;
- spoluhostitel, veřejná projektorová URL a exporty;
- stabilní verzované API a Swift modely pro připojení iOS hráče;
- monitoring latence, výpadků, podvodných vzorců a nákladů;
- teprve potom sezónní varianty a další strategické režimy.

## 13. Testování a kritéria kvality

### Automatické testy

- unit test bodování každého režimu včetně remíz a hranic času;
- property test, že bod nelze připsat dvakrát a skóre nikdy nevznikne bez
  platné odpovědi/události;
- integrační test kompletního stavového automatu;
- contract test web ↔ backend ↔ budoucí iOS;
- reconnect, zprávy mimo pořadí, opakované požadavky a pád hosta;
- Playwright tok vytvořit → připojit → odehrát → report;
- vizuální test host obrazovky 16:9 a hlavních mobilních šířek;
- load test nejdříve 20, 50 a 100 hráčů, poté stanovení limitu.

### Cílová provozní kvalita

- alespoň 99 % úspěšných připojení se správným kódem;
- potvrzení odpovědi běžně do 500 ms v podporovaném regionu;
- obnovení hráče po krátkém výpadku do 3 sekund bez ztráty skóre;
- nulové duplicitní započítání v testech i produkční telemetrii;
- žádná správná odpověď v klientském payloadu před fází `REVEAL`;
- plná obsluha klávesnicí a audit WCAG 2.2 AA pro hlavní flow.

## 14. Metriky produktu

- podíl vytvořených lobby, které se skutečně spustí;
- medián času od otevření hubu ke startu;
- úspěšnost joinu a reconnectu;
- dokončení hry a odchod po jednotlivých kolech;
- opakované hraní stejného a jiného režimu;
- přesnost podle otázky, ne pouze celkové skóre;
- využití klidných vs. soutěžních režimů;
- hlášené/moderované přezdívky a zprávy;
- náklady na jednu dokončenou relaci.

Metriky nesmí ukládat text soukromých sad do analytiky. Experiment se skórováním
musí mít verzi a nesmí zpětně měnit už uložené výsledky.

## 15. Co záměrně nebude v první verzi

- desítky kosmeticky odlišných režimů;
- přímé útoky, které cíleně poníží nebo dlouhodobě vyřadí konkrétního hráče;
- obchod s výhodami ovlivňujícími férovost výukové soutěže;
- AI rozhodování o správnosti každé živé odpovědi;
- vlastní 3D engine, složitá fyzika nebo dlouhé animace;
- veřejný matchmaking s cizími lidmi;
- kopírování názvů, barevných odpovědních tvarů, postav, hudby nebo assetů
  Kahootu a Blooketu.

## 16. Otevřená rozhodnutí a doporučené výchozí hodnoty

| Otázka | Doporučení pro začátek |
|---|---|
| Kdo může hostovat? | přihlášený uživatel |
| Kdo se může připojit? | host bez účtu se stabilním session tokenem |
| Výchozí maximum | 50 hráčů, zvýšit až po load testu |
| Pozdní vstup | zapnutý, do dalšího kola bez bodů za minulost |
| Otázka na zařízení | zapnutá |
| Veřejný leaderboard | top 5; celý report jen hostovi |
| Chat během otázek | vypnutý, reakce omezené |
| Retence detailních odpovědí | 90 dní nebo ruční smazání hostem |
| První tři režimy | Klasická aréna, Přesnost, Společná mise |
| První prémiový rozdíl | pokročilé reporty a kosmetika, ne lepší skóre |

Před implementací Fáze 3 je nutné definitivně rozhodnout vizuální podobu
originálních avatarů, monetizaci kosmetiky a věkové/školní požadavky na data.

## 17. Inspirace a hranice

Z Kahootu přebíráme produktový princip snadného živého hostování, společný
rytmus otázka → vyhodnocení → pořadí → pódium, volbu mezi rychlostí a přesností
a důraz na čitelnou hostovskou obrazovku. Oficiální popis režimů a hostování:

- [Kahoot experiences](https://support.kahoot.com/hc/en-us/articles/35636870654867-Kahoot-experiences)
- [Tips for hosting a live game](https://support.kahoot.com/hc/en-us/articles/360039900153-Tips-for-hosting-a-live-game)
- [Live game settings](https://support.kahoot.com/hc/en-us/articles/115016055107-Live-game-settings)

Z Blooketu přebíráme myšlenku, že katalog může obsahovat synchronní i
samostatně postupující hry a že režim má jasně uvádět zaměření, obtížnost,
doporučený čas a počet hráčů. Strategická vrstva slouží jako krátká odměna mezi
otázkami, nikoli jako náhrada učení. Oficiální přehledy:

- [Blooket Game Mode Previews](https://help.blooket.com/hc/en-us/articles/21408591795351-Blooket-Game-Mode-Previews)
- [Hosting a Blooket Game](https://help.blooket.com/hc/en-us/articles/15984215236503-Hosting-a-Blooket-Game)
- [Laser Tag game overview](https://help.blooket.com/hc/en-us/articles/34102420102807-Game-Overview-Laser-Tag)

Inspirace se týká ověřených principů interakce. DuoCards použije vlastní názvy,
pravidla, skórování, komponenty, ilustrace, animace, zvuky a značku.

## 18. Definice úspěchu Live Game 2.0

Projekt není hotový ve chvíli, kdy se v nabídce objeví názvy režimů. První
produktový milník je splněn, až lze Klasickou arénu, Přesnost a Společnou misi
opakovaně odehrát od lobby po report, obnovit rozehranou relaci po refreshi,
bezpečně určit správnost na serveru a na první pohled vysvětlit rozdíl mezi
režimy. Teprve na tomto základu má smysl přidávat týmy, survival a velkou
strategickou grafiku.
