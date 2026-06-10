# Part: Pricing Engine (`packages/pricing`)

## Účel
Deterministický výpočet prodejní ceny z dodavatelské ceny. Žádná AI. Každý mezivýsledek se uloží pro auditovatelnost.

## Výpočetní postup

```
source_price
  × exchange_rate          (pokud měna ≠ target_currency)
  = price_in_target_currency

  [+ strip VAT pokud sourcePriceIncludesVat = true]
  = price_excl_vat

  × margin_multiplier      (pokud marginMode = MULTIPLIER)
  nebo + margin_amount     (pokud marginMode = FIXED)
  = price_with_margin

  × (1 + targetVatRate/100)
  = price_with_vat

  → rounding_rule
  = final_price
```

## BLOCKER: nejasné DPH

Pokud `sourcePriceIncludesVat = null` (neuvedeno v project.pricing_config):
→ Vytvořit `ValidationIssue` s kódem `PRICE_VAT_UNKNOWN`, severity `BLOCKER`
→ **Nevypočítat cenu** — `target_price` zůstane NULL
→ Produkt → BLOCKED

Toto je záměrné: chyba v DPH = špatná cena pro zákazníka = vážný problém.

## Rounding Rules

```typescript
type RoundingRule = 
  | 'TO_9'       // 489.3 → 489, 490.1 → 489 (na .9 nebo .99)
  | 'TO_0'       // klasické zaokrouhlení na celé číslo
  | 'UP'         // vždy nahoru
  | 'DOWN'       // vždy dolů
  | 'NONE'       // bez zaokrouhlení
```

## Implementace

```typescript
// packages/pricing/src/calculator.ts
interface PriceCalculationResult {
  sourcePrice: number
  sourceCurrency: string
  priceInTargetCurrency: number
  exchangeRate: number
  priceExclVat: number
  sourcePriceIncludesVat: boolean
  priceWithMargin: number
  marginApplied: number
  priceWithVat: number
  vatRate: number
  finalPrice: number
  roundingRule: RoundingRule
}

function calculatePrice(
  sourcePrice: number,
  sourceCurrency: string,
  config: PricingConfig
): PriceCalculationResult | { blocker: 'PRICE_VAT_UNKNOWN' }
```

## Uložení mezivýsledků

Výsledek `PriceCalculationResult` se ukládá jako JSONB do `product_drafts.pricing_breakdown` (nebo separate tabulka pokud potřeba auditu).

Díky tomu reviewer vidí přesně, jak byla cena vypočítána.

## Testování

Unit testy pro každou kombinaci:
- sourcePriceIncludesVat: true / false / null
- marginMode: MULTIPLIER / FIXED
- různé rounding rules
- různé DPH sazby (21%, 15%, 10%, 0%)
- různé měny (EUR→CZK, USD→CZK, CZK→CZK)

Výsledky musí být bit-for-bit reprodukovatelné (žádné float precision issues — použít Decimal.js nebo integer arithmetic v haléřích).
