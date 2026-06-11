import type { ExportManifest } from './types.js'

export function buildManifest(params: {
  batchId: string
  exportId: string
  approvedCount: number
  blockedCount: number
  imageCount: number
  exportedBy: string
}): ExportManifest {
  return {
    batchId: params.batchId,
    exportId: params.exportId,
    createdAt: new Date().toISOString(),
    productCount: params.approvedCount + params.blockedCount,
    approvedCount: params.approvedCount,
    blockedCount: params.blockedCount,
    imageCount: params.imageCount,
    exportedBy: params.exportedBy,
  }
}
