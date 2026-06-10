import type { ProductFact, ProductImage, ProductVariant } from '@zalisto/domain'

export interface ExtractionResult {
  facts: Omit<ProductFact, 'id'>[]
  images: ProductImage[]
  variants: Omit<ProductVariant, 'variantKey'>[]
  confidence: number
  needsBrowserFallback: boolean
}
