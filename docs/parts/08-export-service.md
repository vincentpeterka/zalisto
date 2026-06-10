# Part: Export Service (`packages/export`)

## Účel
Generování Shoptet-ready XLSX, CSV reportů a ZIP archivu s obrázky. Výstup je určen pro manuální import.

## Výstupní struktura

```
batch-{id}/
├── shoptet-import.xlsx       hlavní import soubor
├── validation-report.csv     produkty s issues (včetně BLOCKED)
├── source-report.csv         mapování source_url → výsledný produkt
├── images/
│   ├── samsung-galaxy-s25-ultra-01.webp
│   ├── samsung-galaxy-s25-ultra-02.webp
│   └── ...
└── manifest.json
```

## manifest.json

```json
{
  "batchId": "uuid",
  "exportId": "uuid",
  "createdAt": "2026-06-10T12:00:00Z",
  "productCount": 50,
  "approvedCount": 47,
  "blockedCount": 3,
  "imageCount": 220,
  "exportedBy": "user@example.com"
}
```

## Shoptet XLSX sloupce (klíčové)

| Sloupec Shoptet | Zdroj |
|-----------------|-------|
| Název | product_drafts.title_cs |
| Krátký popis | product_drafts.short_description_cs |
| Dlouhý popis | product_drafts.long_description_cs |
| Výrobce | product_drafts.brand |
| Kód výrobce (MPN) | product_drafts.manufacturer_part_number |
| EAN | product_drafts.gtin |
| Cena s DPH | product_drafts.target_price |
| DPH | product.vat_rate |
| Kategorie | categories.full_path |
| Obrázek 1–10 | product_images order by sort_order |
| Varianta 1..N | product_variants (option_values, sku, gtin, price) |

Mapování udržovat jako konfiguraci (ne hardcoded), připravit na různé verze Shoptet šablony.

## Pravidla exportu

- Do `shoptet-import.xlsx` jdou POUZE produkty se `status = APPROVED`
- Produkty se statusem BLOCKED jdou pouze do `validation-report.csv`
- Každý obrázek v ZIP musí mít odpovídající řádek v XLSX (nebo být označen jako orphan)
- Export je idempotentní — stejný batch generuje stejný výstup (deterministic sort)

## Implementace

```typescript
// packages/export/src/xlsx-builder.ts
async function buildShoptetXlsx(products: ApprovedProduct[]): Promise<Buffer>

// packages/export/src/zip-builder.ts
async function buildExportZip(
  xlsxBuffer: Buffer,
  images: ExportImage[],
  reports: ExportReport[]
): Promise<Buffer>

// packages/export/src/manifest.ts
function buildManifest(batch: ExportBatch): ExportManifest
```

## BullMQ Worker

```typescript
// apps/worker/src/workers/generate-export.ts
// Job: { batchId, requestedBy }
// 1. Načíst approved products
// 2. Stáhnout WebP obrázky ze S3
// 3. buildShoptetXlsx()
// 4. buildValidationReport()
// 5. buildSourceReport()
// 6. buildExportZip()
// 7. Upload ZIP do S3
// 8. Uložit export record
// 9. Notifikovat uživatele (event nebo SSE)
```

## Testování

- Unit test: XLSX sloupce odpovídají Shoptet specifikaci
- Unit test: blokované produkty nejsou v hlavním XLSX
- Integrační test: generovaný ZIP obsahuje správný počet obrázků
- E2E: nahrát výsledný XLSX do Shoptet sandboxu a ověřit import
