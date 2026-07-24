# UI a design systém

> Stav k 2026-07-24 (v1.0.0): platné. Design systém „Midnight Indigo" —
> tokeny jsou v `src/app/globals.css` (půlnoční modro-šedé neutrály, indigo
> jako primární akcent, violet vyhrazený pro AI, emerald úspěch, amber mince,
> font Geist).

## Vizuální charakter

DuoCards používá čisté kartové rozhraní s indigo-violet akcentem (Midnight
Indigo), měkkými radiusy, jemnými stíny a plnou podporou tmavého režimu.
Barvy nezapisuj napřímo — Tailwind škály (`gray`, `blue`, `purple`, `green`,
`yellow`) jsou předefinované v `globals.css`, takže existující utility třídy
automaticky odpovídají design systému. Zachovávej existující Tailwind styl
komponent; nevytvářej lokální CSS systém, pokud lze stejného výsledku
dosáhnout existujícími utility třídami.

## Interaktivita a kurzory

Kurzor vyjadřuje skutečné chování prvku:

- tlačítko, odkaz, klikací karta, přepínač nebo akční ikona: `cursor-pointer`;
- zakázaná akce: `disabled:cursor-not-allowed` a viditelně nižší opacity;
- textový input: výchozí textový kurzor;
- přetahovatelný prvek: `cursor-grab` a během tažení `cursor-grabbing`;
- statický text, badge nebo dekorativní ikona: běžný kurzor.

Ručičku nepřidávej na celý kontejner, pokud je klikací pouze jeho část.
Klikací element musí být skutečný `<button>` nebo `<a>`, ne `<div>` s
`onClick`, pokud k tomu není závažný důvod.

## Tlačítka

- primární akce používá dominantní modrou nebo fialovou;
- sekundární akce používá neutrální pozadí nebo border;
- destruktivní akce používá červenou a vyžaduje potvrzení u nevratných změn;
- ikonová akce má čtvercovou dotykovou plochu, vizuálně odpovídá sousedním
  ikonám a obsahuje lokalizovaný `aria-label` nebo `title`;
- dvě rovnocenné ikony v jednom headeru mají stejnou velikost a padding;
- text tlačítka se nesmí zalomit způsobem, který změní význam nebo zakryje
  ikonu.

## Text a dlouhý obsah

- přezdívka a důležité názvy se mají zobrazit celé nebo bezpečně zalomit;
- `truncate` používej jen tam, kde je dostupný jiný způsob zobrazení celé
  hodnoty, například detail nebo tooltip;
- uživatelský název nikdy automaticky nepřekládej;
- počítej s delšími německými texty, RTL locale a mobilním/úzkým viewportem;
- počty a datumy formátuj podle aktivního locale, pokud to daný tok umožňuje.

## Formuláře

- každý input má viditelný label;
- povinné pole je označené konzistentně;
- placeholder není náhradou labelu;
- validace je lokalizovaná a zobrazí konkrétní problém;
- submit je během požadavku zakázaný a ukazuje průběh;
- toggle musí mít text popisující vlastnost, ne pouze stav „zapnuto“;
- formuláře pro vytvoření a úpravu stejné entity mají stejné názvy polí.

## Karty, menu a vrstvení

- klikací karta má hover/focus stav;
- tlačítka uvnitř karty musí zastavit propagaci, pokud nemají otevřít kartu;
- otevřené menu musí být nad ostatními kartami;
- preferuj zvýšení vrstvy pouze aktivní karty; portal použij, pokud rodičovský
  `overflow` nebo stacking context menu ořezává;
- menu zavři kliknutím mimo, klávesou Escape a po dokončení akce;
- pozici přepočítej při změně viewportu, pokud je menu ukotvené k prvku.

## Modály

- modal má backdrop, `role="dialog"`, `aria-modal="true"` a označený nadpis;
- musí jít zavřít tlačítkem, backdropem a Escape, pokud nejde o kritický tok;
- během otevření zabraň scrollování pozadí a po zavření stav obnov;
- obsah musí mít omezenou výšku a vlastní scroll na menším viewportu;
- potvrzení destruktivní akce jasně rozlišuje potvrdit a zrušit.

## Stavy obrazovky

Každá datová obrazovka má podle potřeby:

- loading stav bez falešného prázdného obsahu;
- prázdný stav s jasnou další akcí;
- chybový stav s lokalizovanou zprávou;
- disabled stav během mutace;
- úspěšnou zpětnou vazbu u kopírování, vytvoření nebo odměny.

## Přístupnost

- ovládání musí být dosažitelné klávesnicí;
- focus stav nesmí být odstraněn bez adekvátní náhrady;
- dekorativní SVG nemá přebírat přístupný název tlačítka;
- barva nesmí být jediným nositelem stavu;
- kontrast ověřuj ve světlém i tmavém režimu;
- dynamické důležité zprávy používají vhodný `aria-live` region.
