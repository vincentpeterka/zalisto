# Part: Review UI (`apps/web`)

## Účel
Next.js aplikace pro review a schválení produktů před exportem. Reviewer vidí původ každé hodnoty, může editovat a schvalovat.

## Stránky (App Router)

```
/                     → redirect → /projects
/login                → přihlašovací stránka
/projects             → seznam projektů
/projects/new         → vytvoření projektu
/projects/[id]        → detail projektu (nastavení + seznam dávek)
/projects/[id]/settings → nastavení (cena, DPH, kategorie)
/batches/new          → nová dávka (URL input nebo CSV upload)
/batches/[id]         → průběh dávky + tabulka produktů
/batches/[id]/export  → export stránka
/products/[id]        → detail produktu (3-panel view)
```

## Tabulka produktů (`/batches/[id]`)

**Sloupce:**
- Thumbnail (50×50)
- Značka + Model
- EAN/GTIN
- Cena
- Kategorie (s confidence badge)
- Problémy (počet BLOCKER/ERROR/WARNING)
- Stav (badge: READY/NEEDS_REVIEW/BLOCKED/APPROVED)

**Filtry (tabs nebo sidebar):**
- Vše
- Ke kontrole (NEEDS_REVIEW)
- Blokováno (BLOCKED)
- Schváleno (APPROVED)
- Bez obrázku
- Konflikt EAN
- Nízká jistota kategorie (<0.80)

**Hromadné akce:**
- "Schválit vše READY" → POST /batches/:id/approve-all

## Detail produktu (`/products/[id]`) — 3-panel layout

```
┌─────────────────┬──────────────────┬───────────────────┐
│   ZDROJ         │   NÁVRH          │   ZDROJE + ISSUES │
│                 │                  │                   │
│ Původní stránka │ Editovatelná     │ Pro každé pole:   │
│ (iframe nebo    │ produktová karta │ odkud pochází      │
│  text extract)  │                  │ (source_facts)    │
│                 │ Obrázky galerie  │                   │
│                 │ (approve/reject) │ ValidationIssues  │
│                 │                  │ (resolve button)  │
│                 │ [Schválit]       │                   │
│                 │ [Zamítnout]      │                   │
└─────────────────┴──────────────────┴───────────────────┘
```

**Panel Návrh — editovatelné pole:**
- Název (textarea)
- Krátký popis (textarea)
- Dlouhý popis (rich text nebo textarea)
- Kategorie (dropdown, search)
- Cena (number input, zobrazit breakdown)
- Značka, Model (text input)
- EAN (read-only pokud validní, editable pokud BLOCKER)

**Zdroje panel:**
Každé pole zobrazí `product_facts` ve formátu:
```
Název:
  ✓ [MANUFACTURER] "Samsung Galaxy S25 Ultra" (conf: 0.99)
    Zdroj: https://samsung.com/...
  ○ [AI_INFERENCE] "Samsung Galaxy S25 Ultra 512GB" (conf: 0.87)
```
Uživatel může vybrat jiný fact jako `is_selected`.

**Issues panel:**
```
🔴 BLOCKER: GTIN_INVALID_CHECKSUM
   EAN 1234567890123 má neplatný kontrolní součet
   [Označit jako vyřešené]

⚠️ WARNING: CATEGORY_LOW_CONFIDENCE
   Kategorie "Telefony" (confidence: 0.72 < 0.80)
```

## Průběh dávky

Live progress (SSE nebo 5s polling):
```
Zpracováváno: 47 / 100
  ✓ Hotovo: 32
  ⏳ Zpracovává se: 15
  👁 Ke kontrole: 8
  🔴 Blokováno: 3
  ✗ Selhalo: 4
```

## UX zásady

- Reviewer nemusí znát technické detaily — UI musí být srozumitelné
- BLOCKER musí být vizuálně odlišný (červená, nelze přehlédnout)
- Každá editace se okamžitě uloží (debounced auto-save nebo explicit save)
- Keyboard shortcuts: `a` = approve, `r` = reject, `→` = next product
- Mobile-friendly není požadavek pro MVP, ale responsive layout je OK
