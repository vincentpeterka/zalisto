import type { IssueSeverity, SourceTrust, ValidationIssueCode } from './enums.js'

export interface ProductFact {
  id: string
  fieldName: string
  valueJson: unknown
  normalizedValue?: string | undefined
  sourceType: SourceTrust
  sourceUrl?: string
  confidence: number
  isSelected: boolean
}

export interface ProductVariant {
  variantKey: string
  sku?: string | undefined
  gtin?: string | undefined
  optionValues: Record<string, string>
  sourcePrice?: number
  stockText?: string
}

export interface ProductImage {
  sourceUrl: string
  sortOrder: number
  variantKey?: string
}

export interface ValidationIssue {
  code: ValidationIssueCode
  severity: IssueSeverity
  fieldName?: string
  message: string
  details?: Record<string, unknown>
}

export interface GeneratedContent {
  titleCs: string
  shortDescriptionCs: string
  longDescriptionCs: string
  bulletPoints: string[]
  warnings: string[]
  usedFactIds: string[]
}

export interface CategoryMatch {
  id: string
  name: string
  fullPath: string
  confidence: number
  reason: string
}

export interface PricingConfig {
  sourcePriceIncludesVat: boolean | null
  exchangeRate: number
  targetCurrency: string
  marginMode: 'MULTIPLIER' | 'FIXED'
  marginValue: number
  targetVatRate: number
  rounding: 'TO_9' | 'TO_0' | 'UP' | 'DOWN' | 'NONE'
}

export interface ProcessedImage {
  sourceUrl: string
  webpBuffer: Buffer
  width: number
  height: number
  sizeBytes: number
  hash: string
  sortOrder: number
}

export interface ProductDraft {
  sourceUrl: string
  brand?: string | undefined
  modelName?: string | undefined
  manufacturerPartNumber?: string | undefined
  gtin?: string | undefined
  productType?: string | undefined
  sourcePrice?: number | undefined
  sourceCurrency?: string | undefined
  facts: ProductFact[]
  variants: ProductVariant[]
  images: ProductImage[]
  issues: ValidationIssue[]
  content?: GeneratedContent
  category?: CategoryMatch
}
