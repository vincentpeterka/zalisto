# Part: Domain Types (`packages/domain`)

## Účel
Sdílené TypeScript typy, enums a doménová pravidla. Závisí na něm všechny ostatní balíčky — nesmí mít žádné externí závislosti kromě TypeScriptu.

## Klíčové exporty

### ProductStatus
```typescript
export const ProductStatus = {
  PENDING: 'PENDING',
  FETCHING: 'FETCHING',
  EXTRACTING: 'EXTRACTING',
  IDENTIFYING: 'IDENTIFYING',
  ENRICHING: 'ENRICHING',
  GENERATING_CONTENT: 'GENERATING_CONTENT',
  PROCESSING_IMAGES: 'PROCESSING_IMAGES',
  VALIDATING: 'VALIDATING',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  BLOCKED: 'BLOCKED',
  APPROVED: 'APPROVED',
  EXPORTED: 'EXPORTED',
  FAILED: 'FAILED',
} as const
export type ProductStatus = typeof ProductStatus[keyof typeof ProductStatus]
```

### IssueSeverity
```typescript
export const IssueSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  BLOCKER: 'BLOCKER',
} as const
```

### SourceTrust
```typescript
export const SourceTrust = {
  MANUFACTURER: 'MANUFACTURER',
  AUTHORIZED_DISTRIBUTOR: 'AUTHORIZED_DISTRIBUTOR',
  SUPPLIER: 'SUPPLIER',
  GS1: 'GS1',
  LICENSED_DATABASE: 'LICENSED_DATABASE',
  SOURCE_PAGE: 'SOURCE_PAGE',
  RETAILER: 'RETAILER',
  AI_INFERENCE: 'AI_INFERENCE',
  USER_INPUT: 'USER_INPUT',
} as const
```

### ValidationIssueCode (string enum)
Klíčové kódy:
- `GTIN_INVALID_CHECKSUM`
- `GTIN_CONFLICT`
- `PRICE_VAT_UNKNOWN`
- `VARIANT_DUPLICATE_GTIN`
- `IMAGE_TOO_SMALL`
- `IMAGE_MODEL_MISMATCH`
- `CATEGORY_LOW_CONFIDENCE`
- `MISSING_SOURCE`
- `RIGHTS_NOT_CONFIRMED`

### OrgRole
```typescript
export const OrgRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', REVIEWER: 'REVIEWER' } as const
```

## Struktury (interfaces)

- `ProductFact` — fieldName, valueJson, normalizedValue?, sourceType, sourceUrl?, confidence, isSelected
- `PricingConfig` — sourcePriceIncludesVat, exchangeRate, marginMode, marginValue, targetVatRate, rounding
- `ImageConfig` — maxLongEdge, webpQuality, minWidth, minHeight
- `TextStyleConfig` — tone, forbiddenClaims[], language

## Pravidla pro stav produktu

Přechody které jsou povoleny a které zakázány (state machine pravidla) — implementovat jako `canTransitionTo(from, to): boolean`.

BLOCKER ValidationIssue → produkt nemůže přejít do APPROVED bez `resolved = true`.
