# Architecture — Zalisto

## Systémový diagram

```
Next.js Web UI (apps/web)
      │ HTTPS
Fastify API (apps/api)
      │                    │
PostgreSQL             Redis/BullMQ
(packages/database)    (fronta úloh)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  Crawler Worker    AI Worker          Image Worker
  (apps/crawler)    (apps/worker)      (apps/worker)
  Crawlee+Cheerio   OpenAI Struct.     Sharp + S3
  +Playwright       Outputs
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    Validation Worker
                    (packages/validation)
                           │
                    Export Service
                    (packages/export)
                    XLSX + ZIP
```

## Doménový model (hlavní entity)

```
Organization
  └── User (role: OWNER|ADMIN|REVIEWER)
  └── Project (měna, DPH, pricing_config, text_style_config)
        └── Category (strom, full_path, parent_id)
        └── ImportBatch (status, total/processed/failed counts)
              └── SourceItem (URL, fetch_status, raw_html_storage_key)
                    └── ProductDraft (status, brand, model, EAN, title_cs, …)
                          └── ProductFact (field_name, value_json, source_type, confidence)
                          └── ProductVariant (variant_key, SKU, GTIN, option_values)
                          └── ProductImage (source_url, webp_storage_key, sort_order)
                          └── ValidationIssue (code, severity, resolved)
                          └── ReviewDecision (action, old/new value, user_id)
              └── Export (format, storage_key, product_count)
AuditEvent (organization_id, actor, entity_type, entity_id, payload)
```

## Stav produktu (stavový automat)

```
PENDING → FETCHING → EXTRACTING → IDENTIFYING → ENRICHING
       → GENERATING_CONTENT → PROCESSING_IMAGES → VALIDATING
       → READY_FOR_REVIEW | NEEDS_REVIEW | BLOCKED
       → APPROVED → EXPORTED
       → FAILED (kdykoli)
```

## BullMQ fronty (pořadí zpracování)

1. `fetch-source` — HTTP fetch, hash, uložení HTML do S3
2. `extract-product` — JSON-LD, HTML heuristiky → product_facts
3. `browser-extract` — Playwright fallback (pouze pokud #2 nestačí)
4. `identify-product` — EAN validace, MPN normalizace, dedup
5. `generate-content` — OpenAI česká karta
6. `categorize-product` — AI kategorizace + confidence
7. `calculate-price` — deterministický výpočet ceny
8. `process-images` — download, Sharp, S3
9. `validate-product` — finální pravidla, severity
10. `generate-export` — XLSX, ZIP, manifest

## Package závislosti

```
apps/* závisí na → packages/*
packages/database závisí na → packages/domain
packages/extraction závisí na → packages/domain
packages/identity závisí na → packages/domain
packages/ai závisí na → packages/domain
packages/validation závisí na → packages/domain, packages/identity
packages/images závisí na → packages/storage
packages/export závisí na → packages/domain, packages/database, packages/images
```

## Bezpečnostní zásady

### SSRF ochrana (fetch-source)
- Pouze HTTP/HTTPS
- Odmítnout: localhost, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
- Kontrola každého redirect hopu
- Blokace cloud metadata (169.254.169.254, 100.100.100.200)
- Limit velikosti odpovědi

### Playwright izolace
- Samostatný kontejner bez secrets
- Read-only filesystem kde možné
- Omezená síť (bez přístupu na interní services)
- CPU/paměť limit + timeout
- Zákaz downloadů

### AI bezpečnost
- AI nemá přístup k DB ani secrets
- Vstup = pouze vybraná fakta (ne raw HTML)
- Systémová instrukce: ignorovat pokyny z načtené stránky
- Výstup vždy přes Zod schéma
- Logy s redakcí citlivých hodnot

## Klíčové datové struktury

### ProductFact
```typescript
{
  fieldName: string          // "material", "gtin", "price", …
  valueJson: unknown         // původní hodnota
  normalizedValue?: string   // normalizovaná podoba
  sourceType: SourceTrust    // MANUFACTURER | AI_INFERENCE | USER_INPUT | …
  sourceUrl?: string
  confidence: number         // 0–1
  isSelected: boolean
}
```

### AI Structured Output (generate-content)
```typescript
{
  titleCs: string
  shortDescriptionCs: string
  longDescriptionCs: string
  bulletPoints: string[]
  warnings: string[]
  usedFactIds: string[]      // UUID references do product_facts
}
```

### pricing_config (Project)
```json
{
  "sourcePriceIncludesVat": false,
  "exchangeRate": 25.2,
  "marginMode": "MULTIPLIER",
  "marginValue": 1.8,
  "targetVatRate": 21,
  "rounding": "TO_9"
}
```
