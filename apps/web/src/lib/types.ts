export type ProductStatus =
  | 'PENDING' | 'FETCHING' | 'EXTRACTING' | 'IDENTIFYING' | 'ENRICHING'
  | 'GENERATING_CONTENT' | 'PROCESSING_IMAGES' | 'VALIDATING'
  | 'READY_FOR_REVIEW' | 'NEEDS_REVIEW' | 'BLOCKED' | 'APPROVED' | 'EXPORTED' | 'FAILED'

export type IssueSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'

export interface ProductSummary {
  id: string
  status: ProductStatus
  titleCs: string | null
  brand: string | null
  modelName: string | null
  gtin: string | null
  targetPrice: string | null
  categoryId: string | null
  sourceUrl: string
  createdAt: string
  updatedAt: string
}

export interface ProductFact {
  id: string
  fieldName: string
  valueJson: unknown
  normalizedValue: string | null
  sourceType: string
  sourceUrl: string | null
  confidence: string | null
  isSelected: boolean
}

export interface ProductImage {
  id: string
  sourceUrl: string
  webpStorageKey: string | null
  width: number | null
  height: number | null
  status: 'PENDING' | 'PROCESSED' | 'TOO_SMALL' | 'FAILED'
  rightsConfirmed: boolean
  sortOrder: number
}

export interface ValidationIssue {
  id: string
  code: string
  fieldName: string | null
  severity: IssueSeverity
  message: string
  details: Record<string, unknown>
  resolved: boolean
  createdAt: string
}

export interface ReviewDecision {
  id: string
  action: string
  fieldName: string | null
  oldValue: unknown
  newValue: unknown
  note: string | null
  createdAt: string
}

export interface ProductDetail {
  draft: {
    id: string
    status: ProductStatus
    brand: string | null
    modelName: string | null
    manufacturerPartNumber: string | null
    gtin: string | null
    titleCs: string | null
    shortDescriptionCs: string | null
    longDescriptionCs: string | null
    bulletPointsCs: string[] | null
    targetPrice: string | null
    categoryId: string | null
    categoryConfidence: string | null
    approvedAt: string | null
    createdAt: string
    updatedAt: string
  }
  facts: ProductFact[]
  images: ProductImage[]
  issues: ValidationIssue[]
  decisions: ReviewDecision[]
}

export interface User {
  id: string
  email: string
  name: string | null
}
