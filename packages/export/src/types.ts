export interface ApprovedProductImage {
  imageId: string
  webpFilename: string
  sortOrder: number
}

export interface ApprovedProductVariant {
  variantKey: string
  sku: string | null
  gtin: string | null
  targetPrice: string | null
  optionValues: Record<string, string>
}

export interface ApprovedProduct {
  id: string
  titleCs: string | null
  shortDescriptionCs: string | null
  longDescriptionCs: string | null
  brand: string | null
  manufacturerPartNumber: string | null
  gtin: string | null
  targetPrice: string | null
  vatRate: string | null
  categoryFullPath: string | null
  sourceUrl: string
  images: ApprovedProductImage[]
  variants: ApprovedProductVariant[]
}

export interface BlockedProduct {
  id: string
  titleCs: string | null
  brand: string | null
  gtin: string | null
  sourceUrl: string
  blockerCodes: string[]
  errorCodes: string[]
}

export interface SourceReportRow {
  sourceUrl: string
  productId: string
  title: string | null
  status: string
  gtin: string | null
}

export interface ExportManifest {
  batchId: string
  exportId: string
  createdAt: string
  productCount: number
  approvedCount: number
  blockedCount: number
  imageCount: number
  exportedBy: string
}
