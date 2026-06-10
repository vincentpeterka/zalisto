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

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus]

export const IssueSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  BLOCKER: 'BLOCKER',
} as const

export type IssueSeverity = (typeof IssueSeverity)[keyof typeof IssueSeverity]

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

export type SourceTrust = (typeof SourceTrust)[keyof typeof SourceTrust]

export const ValidationIssueCode = {
  GTIN_INVALID_CHECKSUM: 'GTIN_INVALID_CHECKSUM',
  GTIN_CONFLICT: 'GTIN_CONFLICT',
  PRICE_VAT_UNKNOWN: 'PRICE_VAT_UNKNOWN',
  VARIANT_DUPLICATE_GTIN: 'VARIANT_DUPLICATE_GTIN',
  IMAGE_TOO_SMALL: 'IMAGE_TOO_SMALL',
  IMAGE_DOWNLOAD_FAILED: 'IMAGE_DOWNLOAD_FAILED',
  CATEGORY_LOW_CONFIDENCE: 'CATEGORY_LOW_CONFIDENCE',
  MISSING_BRAND: 'MISSING_BRAND',
  MISSING_MODEL: 'MISSING_MODEL',
  MISSING_SOURCE: 'MISSING_SOURCE',
  NO_USABLE_IMAGE: 'NO_USABLE_IMAGE',
  RIGHTS_NOT_CONFIRMED: 'RIGHTS_NOT_CONFIRMED',
} as const

export type ValidationIssueCode =
  (typeof ValidationIssueCode)[keyof typeof ValidationIssueCode]

export const OrgRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  REVIEWER: 'REVIEWER',
} as const

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole]

export const ExportFormat = {
  SHOPTET_XLSX: 'SHOPTET_XLSX',
  CSV: 'CSV',
  ZIP: 'ZIP',
} as const

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat]
