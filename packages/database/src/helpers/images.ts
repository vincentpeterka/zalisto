import { db, productDrafts, productImages } from '../index.js'
import { eq, sql } from 'drizzle-orm'

export interface ProductImageUpdate {
  sourceHash: string
  originalStorageKey: string
  webpStorageKey: string
  width: number
  height: number
  sizeBytes: number
  status: 'PROCESSED' | 'TOO_SMALL' | 'FAILED'
}

export async function updateProductImage(imageId: string, data: ProductImageUpdate): Promise<void> {
  await db.update(productImages)
    .set({
      sourceHash: data.sourceHash,
      originalStorageKey: data.originalStorageKey,
      webpStorageKey: data.webpStorageKey,
      width: data.width,
      height: data.height,
      sizeBytes: data.sizeBytes,
      status: data.status,
    })
    .where(eq(productImages.id, imageId))
}

export async function updateDraftStatusAfterImages(draftId: string, status: string): Promise<void> {
  await db.update(productDrafts)
    .set({
      status: status as 'READY_FOR_REVIEW' | 'NEEDS_REVIEW',
      updatedAt: sql`now()`,
    })
    .where(eq(productDrafts.id, draftId))
}
