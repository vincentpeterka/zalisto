import { db, productDrafts, productFacts, productImages } from '../index.js'
import type { ExtractionResult } from '@zalisto/extraction'

export interface InsertDraftWithFactsParams {
  sourceItemId: string
  sourceUrl: string
  extraction: ExtractionResult
}

export async function insertProductDraftWithFacts(params: InsertDraftWithFactsParams) {
  const { sourceItemId, sourceUrl: _sourceUrl, extraction } = params

  const [draft] = await db.insert(productDrafts).values({
    sourceItemId,
    status: 'EXTRACTING',
  }).returning({ id: productDrafts.id })

  if (!draft) throw new Error(`Failed to insert productDraft for sourceItem ${sourceItemId}`)

  if (extraction.facts.length > 0) {
    await db.insert(productFacts).values(
      extraction.facts.map(fact => ({
        productDraftId: draft.id,
        fieldName: fact.fieldName,
        valueJson: fact.valueJson,
        normalizedValue: fact.normalizedValue ?? null,
        sourceType: fact.sourceType,
        sourceUrl: fact.sourceUrl ?? null,
        confidence: fact.confidence != null ? String(fact.confidence) : null,
        isSelected: fact.isSelected,
      }))
    )
  }

  if (extraction.images.length > 0) {
    await db.insert(productImages).values(
      extraction.images.map(img => ({
        productDraftId: draft.id,
        sourceUrl: img.sourceUrl,
        sortOrder: img.sortOrder,
      }))
    )
  }

  return draft.id
}
