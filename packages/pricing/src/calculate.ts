import type { PricingConfig } from '@zalisto/domain'

export interface PriceBreakdown {
  sourcePrice: number
  sourceCurrency: string
  exchangeRate: number
  priceInTargetCurrency: number
  priceExcludingVat: number
  priceAfterMargin: number
  vatAmount: number
  priceBeforeRounding: number
  finalPrice: number
  targetCurrency: string
  targetVatRate: number
  marginMode: 'MULTIPLIER' | 'FIXED'
  marginValue: number
  roundingMode: string
}

export type PriceCalculationResult =
  | { ok: true; breakdown: PriceBreakdown }
  | { ok: false; reason: 'VAT_STATUS_UNKNOWN' | 'INVALID_CONFIG' | 'NO_PRICE' }

export function calculatePrice(
  sourcePrice: number | null | undefined,
  sourceCurrency: string | null | undefined,
  config: PricingConfig,
): PriceCalculationResult {
  if (sourcePrice == null || isNaN(sourcePrice) || sourcePrice <= 0) {
    return { ok: false, reason: 'NO_PRICE' }
  }

  if (config.sourcePriceIncludesVat === null) {
    return { ok: false, reason: 'VAT_STATUS_UNKNOWN' }
  }

  if (config.exchangeRate <= 0 || config.targetVatRate < 0 || config.marginValue < 0) {
    return { ok: false, reason: 'INVALID_CONFIG' }
  }

  const priceInTargetCurrency = sourcePrice * config.exchangeRate

  const vatDivisor = 1 + config.targetVatRate / 100
  const priceExcludingVat = config.sourcePriceIncludesVat
    ? priceInTargetCurrency / vatDivisor
    : priceInTargetCurrency

  const priceAfterMargin =
    config.marginMode === 'MULTIPLIER'
      ? priceExcludingVat * config.marginValue
      : priceExcludingVat + config.marginValue

  const vatAmount = priceAfterMargin * (config.targetVatRate / 100)
  const priceBeforeRounding = priceAfterMargin + vatAmount

  const finalPrice = applyRounding(priceBeforeRounding, config.rounding)

  return {
    ok: true,
    breakdown: {
      sourcePrice,
      sourceCurrency: sourceCurrency ?? config.targetCurrency,
      exchangeRate: config.exchangeRate,
      priceInTargetCurrency,
      priceExcludingVat,
      priceAfterMargin,
      vatAmount,
      priceBeforeRounding,
      finalPrice,
      targetCurrency: config.targetCurrency,
      targetVatRate: config.targetVatRate,
      marginMode: config.marginMode,
      marginValue: config.marginValue,
      roundingMode: config.rounding,
    },
  }
}

function applyRounding(price: number, mode: PricingConfig['rounding']): number {
  switch (mode) {
    case 'TO_9':
      // Nearest integer ending in 9 (psychological pricing)
      return Math.round((price - 9) / 10) * 10 + 9
    case 'TO_0':
      return Math.round(price / 10) * 10
    case 'UP':
      return Math.ceil(price)
    case 'DOWN':
      return Math.floor(price)
    case 'NONE':
    default:
      return price
  }
}
