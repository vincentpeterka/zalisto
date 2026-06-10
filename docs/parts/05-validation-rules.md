# Part: Validation Rules (`packages/validation`)

## Účel
Deterministická validace produktových dat. Generuje `ValidationIssue` záznamy se severity. Žádná AI.

## Severity a jejich dopad na stav produktu

| Severity | Dopad na stav |
|----------|---------------|
| BLOCKER  | Produkt → BLOCKED, export zakázán bez resolved=true |
| ERROR    | Produkt → NEEDS_REVIEW |
| WARNING  | Produkt → READY_FOR_REVIEW, ale upozornění viditelné |
| INFO     | Pouze informativní, neovlivní stav |

## BLOCKER pravidla

```typescript
// GTIN_INVALID_CHECKSUM
// Podmínka: gtin není null AND checksum selhává
// Zpráva: "EAN/GTIN {value} má neplatný kontrolní součet"

// GTIN_CONFLICT
// Podmínka: stejný GTIN existuje v jiném product_draft ve stejném projektu
// Zpráva: "EAN {value} je již použit v produktu {conflictId}"

// PRICE_VAT_UNKNOWN
// Podmínka: source_price != null AND project.pricing_config.sourcePriceIncludesVat = null
// Zpráva: "Nelze vypočítat cenu — není jasné, zda zdrojová cena obsahuje DPH"

// VARIANT_DUPLICATE_GTIN
// Podmínka: dvě varianty stejného produktu mají stejný GTIN
// Zpráva: "Varianty {v1} a {v2} mají shodný EAN {value}"

// RIGHTS_NOT_CONFIRMED
// Podmínka: product_images existují AND žádný obrázek nemá rights_confirmed = true
// Zpráva: "Práva k obrázkům nebyla potvrzena"
```

## ERROR pravidla

```typescript
// MISSING_BRAND
// Podmínka: brand IS NULL OR brand.trim() = ''

// MISSING_MODEL
// Podmínka: model_name IS NULL OR model_name.trim() = ''

// NO_USABLE_IMAGE
// Podmínka: žádný product_image se status != FAILED

// MISSING_CATEGORY
// Podmínka: category_id IS NULL

// INVALID_PRICE
// Podmínka: target_price <= 0 OR target_price IS NULL (pokud source_price existuje)
```

## WARNING pravidla

```typescript
// CATEGORY_LOW_CONFIDENCE
// Podmínka: category confidence < project.categorization_threshold (výchozí 0.80)

// MISSING_SHORT_DESCRIPTION
// Podmínka: short_description_cs IS NULL OR length < 20

// SMALL_IMAGE
// Podmínka: všechny obrázky mají width < 800 OR height < 800

// MISSING_PARAMETER
// Podmínka: důležitý parametr chybí (záleží na kategorii)
```

## Implementace

```typescript
// packages/validation/src/validate-product.ts
interface ValidationRule {
  code: ValidationIssueCode
  severity: IssueSeverity
  check(draft: ProductDraftWithRelations): boolean
  message(draft: ProductDraftWithRelations): string
  fieldName?: string
}

async function validateProduct(draftId: string): Promise<ValidationIssue[]> {
  const draft = await getProductDraftWithFacts(draftId)
  const issues: ValidationIssue[] = []
  
  for (const rule of ALL_RULES) {
    if (rule.check(draft)) {
      issues.push({ code: rule.code, severity: rule.severity, ... })
    }
  }
  
  // Uložit issues, určit finální status
  const finalStatus = determineStatus(issues)
  await updateProductDraft(draftId, { status: finalStatus })
  return issues
}

function determineStatus(issues: ValidationIssue[]): ProductStatus {
  if (issues.some(i => i.severity === 'BLOCKER')) return 'BLOCKED'
  if (issues.some(i => i.severity === 'ERROR')) return 'NEEDS_REVIEW'
  return 'READY_FOR_REVIEW'
}
```

## Testování

Každé pravidlo má unit test s:
- Validní produkt → žádný issue
- Produkt porušující pravidlo → správný issue code a severity
- Edge cases (null, empty string, boundary values)
