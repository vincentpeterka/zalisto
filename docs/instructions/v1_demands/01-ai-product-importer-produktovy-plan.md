# AI Product Importer
## Produktový a obchodní plán rodinné firmy

**Pracovní název produktu:** AI Product Importer  
**Verze dokumentu:** MVP návrh 1.0  
**Primární trh:** české a slovenské malé a střední e-shopy, nejprve Shoptet  
**Hlavní případ použití:** převod vybraných produktů z webu nebo katalogu zahraničního dodavatele do hotových českých produktových karet

---

## 1. Shrnutí projektu

Cílem je vytvořit webovou aplikaci, která výrazně zrychlí ruční zakládání produktů do e-shopu.

Uživatel vloží:

- URL produktové stránky dodavatele,
- seznam URL,
- nebo tabulku s vybranými produkty.

Aplikace následně:

1. načte dostupná produktová data,
2. rozpozná konkrétní výrobek a jeho varianty,
3. dohledá a porovná chybějící údaje z povolených zdrojů,
4. stáhne a optimalizuje obrázky,
5. vytvoří originální český název a popis,
6. navrhne správnou kategorii,
7. připraví cenu podle zadaného pravidla,
8. označí nejistá nebo konfliktní pole,
9. vytvoří soubor připravený pro import do Shoptetu,
10. vytvoří balík optimalizovaných obrázků.

První verze nebude zapisovat přímo do živého Shoptetu. Výsledkem bude kontrolovatelná dávka a exportní soubor.

---

## 2. Problém, který řešíme

Malý nebo střední obchodník často vybere u nového dodavatele pouze několik desítek produktů. Dodavatel mu poskytne například:

- Excel,
- PDF katalog,
- neveřejný partnerský web,
- odkazy na jednotlivé produktové stránky,
- nebo pouze přístup do svého e-shopu.

Potom zaměstnanec ručně:

- kopíruje názvy,
- hledá EAN a výrobní kód,
- stahuje fotografie,
- zmenšuje je a převádí do WebP,
- překládá popisy,
- vytváří nový český text,
- přepočítává ceny,
- vybírá kategorii,
- zakládá varianty,
- vyplňuje produktovou kartu.

Tato práce je pomalá, opakující se a náchylná k chybám. U složitější karty může zabrat desítky minut.

### Hlavní bolest zákazníka

Zákazník nechce napojit celý katalog dodavatele. Chce například:

> „Vybral jsem 73 konkrétních výrobků. Tady jsou odkazy. Potřebuji je rychle připravit pro svůj e-shop.“

---

## 3. Produktová teze

Neprodáváme obecný scraper ani další generátor popisků.

Prodáváme:

> **Poloautomatickou výrobní linku na kvalitní produktové karty z neuspořádaných podkladů zahraničních dodavatelů.**

Základní princip:

- AI připravuje návrh.
- Pevná pravidla hlídají kritická pole.
- Člověk schvaluje konflikty a výjimky.
- Žádný neověřený údaj se nesmí tvářit jako jistota.

---

## 4. Cíloví zákazníci

### Primární segment

Malé a střední e-shopy, které:

- používají Shoptet,
- mají přibližně 100 až 20 000 produktů,
- pravidelně zařazují menší dávky nového zboží,
- odebírají od zahraničních výrobců nebo velkoobchodů,
- nemají kvalitní XML feed,
- nechtějí napojovat celý sortiment dodavatele,
- dnes zadávají produkty ručně.

### Sekundární segment

- agentury spravující více e-shopů,
- externí správci produktových katalogů,
- distributoři připravující lokalizovaná produktová data,
- firmy migrující část katalogu,
- provozovatelé WooCommerce nebo jiných platforem.

### Nevhodný zákazník pro MVP

- marketplace s miliony položek,
- firma požadující plně autonomní import bez kontroly,
- dodavatel s agresivní ochranou proti automatizovanému přístupu,
- firma bez práv k použití textů a fotografií,
- zákazník vyžadující okamžitou synchronizaci skladu a cen.

---

## 5. Hlavní hodnotová nabídka

### Pro majitele e-shopu

- rychlejší uvedení nového sortimentu,
- méně ruční práce,
- jednotná kvalita karet,
- lepší obrázky,
- české texty připravené pro zákazníka,
- transparentní upozornění na chybějící data,
- nižší počet chyb při importu.

### Pro agenturu

- zpracování více zakázek stejným týmem,
- opakovatelný postup,
- klientské reporty,
- možnost účtovat za výsledek, nikoli za hodiny.

### Pro zaměstnance

- nekontroluje každé pole ručně,
- řeší pouze konflikty a výjimky,
- soustředí se na kvalitu a obchodní rozhodnutí.

---

## 6. Rozsah první verze

### MVP musí umět

1. založit zákazníka a projekt,
2. přijmout jednu URL nebo dávku URL,
3. přijmout jednoduchý Excel/CSV se zdrojovými URL,
4. načíst běžnou produktovou stránku,
5. vytěžit JSON-LD, HTML a dostupná variantní data,
6. vytvořit normalizovaný návrh produktu,
7. ověřit formát EAN/GTIN,
8. porovnat značku, model, MPN a EAN,
9. vytvořit český název,
10. vytvořit originální krátký a dlouhý popis,
11. stáhnout povolené produktové fotografie,
12. převést fotografie do WebP,
13. navrhnout kategorii ze stromu dodaného zákazníkem,
14. vypočítat prodejní cenu podle pravidla,
15. zobrazit původ každého důležitého údaje,
16. označit konflikty a nejistá pole,
17. umožnit ruční opravu a schválení,
18. exportovat Shoptet XLSX/CSV,
19. vytvořit ZIP s obrázky a reportem.

### MVP nemá umět

- přímý zápis do Shoptetu,
- pravidelnou synchronizaci skladů,
- automatické objednávání u dodavatelů,
- obcházení přihlášení, CAPTCHA nebo technických blokací,
- libovolné stahování chráněného obsahu,
- plně automatický import bez kontroly,
- vlastní rozsáhlou produktovou databázi,
- podporu všech e-shopových platforem,
- zpracování PDF katalogů v první etapě,
- automatické právní posouzení produktu.

---

## 7. Uživatelský proces

### 7.1 Vytvoření projektu

Uživatel zadá:

- název obchodu,
- cílový jazyk,
- měnu,
- sazbu DPH,
- pravidlo marže,
- pravidlo zaokrouhlení,
- strom kategorií,
- styl produktových textů,
- maximální rozměr obrázků,
- požadovanou kvalitu WebP.

### 7.2 Vložení produktů

Možnosti:

- jedna URL,
- více URL vložených po řádcích,
- CSV/XLSX s URL, kódem a případně nákupní cenou.

### 7.3 Automatické zpracování

Každý produkt projde:

1. bezpečným načtením stránky,
2. extrakcí dat,
3. normalizací,
4. identifikací produktu,
5. kontrolou EAN,
6. zpracováním variant,
7. zpracováním fotografií,
8. tvorbou českého obsahu,
9. kategorizací,
10. cenovým výpočtem,
11. validačními pravidly.

### 7.4 Kontrolní obrazovka

Produkty budou rozděleny na:

- **Připraveno ke schválení**
- **Vyžaduje kontrolu**
- **Zablokováno**

Uživatel uvidí:

- původní data,
- nový návrh,
- zdroj každého údaje,
- konflikty,
- důvod nízké jistoty,
- náhled obrázků,
- budoucí podobu produktové karty.

### 7.5 Export

Výstup:

- importní tabulka pro Shoptet,
- ZIP obrázků,
- seznam zdrojových URL,
- report konfliktů,
- protokol schválení.

---

## 8. Pravidla důvěryhodnosti

### Údaje, které AI nesmí vymýšlet

- EAN/GTIN,
- MPN nebo výrobní kód,
- rozměry,
- hmotnost,
- materiál,
- certifikace,
- nosnost,
- bezpečnostní vlastnosti,
- počet kusů v balení,
- technická kompatibilita,
- záruka,
- dostupnost,
- cena,
- sazba DPH.

### Pořadí důvěryhodnosti zdrojů

1. výrobce,
2. oficiální distributor,
3. autorizovaný dodavatelský katalog,
4. GS1 nebo licencovaná produktová databáze,
5. zdrojová stránka zákazníka,
6. jiný e-shop jako podpůrný zdroj,
7. AI odvození.

### Povinné zastavení

Produkt se nesmí exportovat automaticky, když:

- se rozcházejí EANy,
- není jasná varianta,
- není jasné balení,
- cena může být s DPH i bez DPH,
- obrázky zřejmě patří jinému modelu,
- zdrojová stránka neobsahuje dost dat,
- chybí právo použít fotografii nebo text,
- produkt obsahuje regulované nebo bezpečnostně významné údaje bez zdroje.

---

## 9. Originalita produktového textu

Aplikace nebude pouze překládat cizí popis větu po větě.

Správný postup:

1. vytěžit ověřitelná fakta,
2. oddělit marketingová tvrzení od technických údajů,
3. sestavit faktickou matici,
4. vytvořit nový český text podle šablony zákazníka,
5. nepřidávat vlastnosti bez zdroje,
6. uvádět praktické použití pouze tam, kde je doložitelné,
7. uložit zdroje použitých faktů.

Výsledkem má být nový a užitečný produktový text, nikoli mechanická parafráze konkurence.

---

## 10. Zpracování obrázků

MVP bude:

- stahovat pouze obrázky, k jejichž použití zákazník deklaruje oprávnění,
- zachovávat původní URL,
- kontrolovat formát a minimální rozlišení,
- odstraňovat zbytečná metadata,
- normalizovat orientaci,
- převádět do WebP,
- omezovat rozměry a velikost,
- vytvářet bezpečné názvy souborů,
- hledat duplicitní obrázky pomocí hashů,
- přiřazovat obrázky k variantám.

Příklad názvu:

`znacka-model-varianta-01.webp`

---

## 11. Obchodní model

### Fáze 1: služba podporovaná softwarem

Zpočátku zákazník neposílá peníze za SaaS, ale za hotovou dávku produktů.

Možné ceny:

- minimální zakázka: 1 490 až 2 490 Kč,
- jednoduchý produkt ze strukturovaného zdroje: 20 až 30 Kč,
- produkt z webové stránky: 30 až 50 Kč,
- variantní nebo technický produkt: 60 až 150 Kč,
- individuální adaptér dodavatele: jednorázový poplatek.

Výhoda:

- produkt lze ověřit dříve, než vznikne plné SaaS,
- zákazník hodnotí výsledek, ne technologii,
- tým se naučí reálné výjimky.

### Fáze 2: předplatné

Možný model:

- Start: omezený počet produktů,
- Pro: vyšší limit, vlastní šablony a historie,
- Agentura: více klientů a týmové role,
- kredity za zpracovaný produkt,
- příplatek za prohlížečové zpracování složitých stránek.

### Doporučení

Nesnažit se vyhrát nejnižší cenou. Prodávat:

- rychlost,
- kontrolu,
- konzistentní kvalitu,
- dohledatelné zdroje,
- možnost zpracovat dávku za jeden den.

---

## 12. Ověření trhu před plným vývojem

### Rozhovory

Provést alespoň 15 rozhovorů s:

- majiteli Shoptet obchodů,
- správci katalogů,
- e-shopovými agenturami,
- distributory zahraničních značek.

Otázky:

- Jak dnes zakládáte produkty?
- Kolik karet měsíčně vzniká?
- Kolik času zabere jednoduchá a složitá karta?
- Které části jsou nejhorší?
- Kolik chyb vzniká?
- Jaké podklady dostáváte od dodavatelů?
- Kdo má práva k fotografiím?
- Kolik platíte za kartu?
- Zaplatili byste za rychlejší dávkové zpracování?
- Potřebujete výstup, nebo přímý import?

### První placený pilot

Cíl:

- jeden skutečný klient,
- 50 až 100 produktů,
- jeden nebo dva dodavatelské weby,
- jednoznačně definovaná kategorie zboží.

Měřit:

- průměrný čas na produkt,
- počet automaticky připravených karet,
- počet konfliktů,
- počet ručních oprav,
- chybovost po importu,
- náklady na AI a infrastrukturu,
- částku, kterou zákazník skutečně zaplatí.

### Go/No-Go kritéria

Pokračovat, pokud:

- lidská kontrola klesne pod 2 minuty na běžný produkt,
- alespoň 70 % jednoduchých produktů projde bez zásadní opravy,
- kritické údaje nejsou vymyšlené,
- zákazník zaplatí za opakovanou dávku,
- hrubá marže po AI a infrastruktuře je zdravá,
- nový dodavatel nevyžaduje pokaždé kompletní přepsání systému.

---

## 13. Konkurenční pozice

Produkt nebude soutěžit přímo s nástroji pro pravidelné feedové napojení celého dodavatelského katalogu.

Odlišení:

- pracuje s vybranými URL,
- umí chaotické podklady,
- připravuje originální český obsah,
- optimalizuje fotografie,
- ukazuje původ jednotlivých údajů,
- pracuje s lidským schválením,
- připravuje dávku pro import,
- je vhodný i pro desítky, ne pouze tisíce produktů.

Hlavní konkurent není jen software. Je to:

- interní zaměstnanec,
- brigádník,
- virtuální asistent,
- agentura účtující cenu za kartu,
- ruční kopírování.

---

## 14. Hlavní rizika

### Technická

- každá stránka má jinou strukturu,
- dynamické varianty jsou obtížné,
- některé weby blokují automatizaci,
- stejné EANy mohou být uvedeny chybně,
- obrázky mohou patřit k jiné variantě,
- některé stránky vyžadují přihlášení.

### Obchodní

- zákazníci mohou zpracovávat příliš málo produktů,
- cena ruční práce může být příliš nízká,
- firmy mohou chtít úplnou automatizaci bez kontroly,
- trh může preferovat agenturní službu před SaaS.

### Právní

- autorská práva k fotografiím a textům,
- podmínky webů a databází,
- ochrana databází,
- zpracování osobních údajů,
- regulované produkty,
- odpovědnost za chybné technické údaje.

### Provozní

- podpora atypických dodavatelů,
- náklady na prohlížečový crawling,
- rostoucí počet výjimek,
- závislost na externích AI službách.

---

## 15. Role v rodinné firmě

### Produkt a obchod

Odpovědnost:

- rozhovory se zákazníky,
- výběr cílového segmentu,
- formulace služby,
- prodej pilotů,
- kontrola kvality,
- návrh obrazovek,
- dokumentace,
- marketing,
- zákaznická komunikace.

### Technologie

Odpovědnost:

- architektura,
- implementace,
- datový model,
- crawling,
- AI integrace,
- validace,
- fronty úloh,
- bezpečnost,
- testy,
- monitoring,
- nasazení.

### AI

Použití:

- návrhy a revize kódu,
- extrakce nestrukturovaných údajů,
- kategorizace,
- tvorba textů,
- testovací scénáře,
- dokumentace,
- analýza chyb.

AI není odpovědný autor dat ani provozovatel systému.

---

## 16. Produktové metriky

### Kvalita

- podíl produktů bez kritické opravy,
- počet konfliktů správně zachycených systémem,
- počet chybných EANů v exportu,
- počet chybných variant,
- počet vymyšlených faktů,
- počet vrácených zakázek.

### Rychlost

- čas automatického zpracování,
- čas lidské kontroly na produkt,
- čas od vložení URL k hotovému exportu.

### Ekonomika

- náklad AI na produkt,
- náklad browser workeru na produkt,
- hrubá marže,
- průměrná hodnota dávky,
- počet opakovaných klientů,
- měsíční počet zpracovaných produktů.

### Produkt-market fit

- kolik klientů objedná druhou dávku,
- kolik produktů zpracují měsíčně,
- kolik zákazníků doporučí produkt dál,
- za které funkce jsou ochotni připlatit.

---

## 17. Doporučená cesta

1. Neprogramovat plný doplněk.
2. Najít jednoho pilotního zákazníka.
3. Vzít 50 až 100 reálných produktů.
4. Zvolit jeden typ zboží.
5. Vytvořit interní poloautomatický prototyp.
6. Změřit kvalitu, čas a cenu.
7. Opravit proces.
8. Teprve potom vytvořit webové MVP.
9. Až po opakovaných placených dávkách řešit SaaS.
10. Přímé napojení na Shoptet odložit až za ověřený export.

---

## 18. Finální produktová formulace

> **AI Product Importer převádí vybrané produkty ze zahraničních webů a katalogů do kontrolovatelných českých produktových karet. Připraví data, originální texty, ceny, kategorie a optimalizované obrázky a vytvoří export pro Shoptet. Kritické údaje nikdy nevymýšlí a všechny nejistoty pošle člověku ke schválení.**

---

## 19. Hlavní zásada

> **Nejdřív správný produkt. Potom rychlý produkt. A teprve nakonec autonomní produkt.**
