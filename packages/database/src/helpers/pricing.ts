import { db, productDrafts } from '../index.js'
import { eq, sql } from 'drizzle-orm'

export interface DraftPriceUpdate {
  targetPrice: number
  pricingBreakdown: Record<string, unknown>
  status?: string
}

export async function updateDraftPrice(draftId: string, data: DraftPriceUpdate): Promise<void> {
  await db.update(productDrafts)
    .set({
      targetPrice: String(data.targetPrice),
      pricingBreakdown: data.pricingBreakdown,
      ...(data.status !== undefined && { status: data.status as 'PROCESSING_IMAGES' | 'NEEDS_REVIEW' }),
      updatedAt: sql`now()`,
    })
    .where(eq(productDrafts.id, draftId))
}
