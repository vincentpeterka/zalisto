import { db, productDrafts } from '../index.js'
import { eq, sql } from 'drizzle-orm'

export interface DraftContentUpdate {
  titleCs?: string
  shortDescriptionCs?: string
  longDescriptionCs?: string
  bulletPointsCs?: string[]
  aiUsedFactIds?: string[]
  status?: string
}

export async function updateDraftContent(draftId: string, data: DraftContentUpdate): Promise<void> {
  await db.update(productDrafts)
    .set({
      ...(data.titleCs !== undefined && { titleCs: data.titleCs }),
      ...(data.shortDescriptionCs !== undefined && { shortDescriptionCs: data.shortDescriptionCs }),
      ...(data.longDescriptionCs !== undefined && { longDescriptionCs: data.longDescriptionCs }),
      ...(data.bulletPointsCs !== undefined && { bulletPointsCs: data.bulletPointsCs }),
      ...(data.aiUsedFactIds !== undefined && { aiUsedFactIds: data.aiUsedFactIds }),
      ...(data.status !== undefined && { status: data.status as 'READY_FOR_REVIEW' | 'NEEDS_REVIEW' | 'BLOCKED' }),
      updatedAt: sql`now()`,
    })
    .where(eq(productDrafts.id, draftId))
}

export interface DraftCategoryUpdate {
  categoryId?: string | null
  categoryConfidence?: number
  status?: string
}

export async function updateDraftCategory(draftId: string, data: DraftCategoryUpdate): Promise<void> {
  await db.update(productDrafts)
    .set({
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.categoryConfidence !== undefined && { categoryConfidence: String(data.categoryConfidence) }),
      ...(data.status !== undefined && { status: data.status as 'READY_FOR_REVIEW' | 'NEEDS_REVIEW' }),
      updatedAt: sql`now()`,
    })
    .where(eq(productDrafts.id, draftId))
}
