import { Worker, Queue, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import {
  db, productDrafts, productFacts, projects, categories,
  sourceItems, importBatches, updateDraftCategory, insertValidationIssue,
} from '@zalisto/database'
import { eq } from 'drizzle-orm'
import { categorizeProduct } from '@zalisto/ai'

export interface CategorizeProductJobData {
  sourceItemId: string
  productDraftId: string
}

export function startCategorizeProductWorker(connection: Redis) {
  const calculatePriceQueue = new Queue('calculate-price', { connection })

  const worker = new Worker<CategorizeProductJobData>(
    'categorize-product',
    async (job: Job<CategorizeProductJobData>) => {
      const { productDraftId, sourceItemId } = job.data

      const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, productDraftId))
      if (!draft) throw new Error(`productDraft ${productDraftId} not found`)

      // Resolve project + confidence threshold
      const [projectRow] = await db
        .select({ projectId: importBatches.projectId, threshold: projects.categoryConfidenceThreshold })
        .from(sourceItems)
        .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
        .innerJoin(projects, eq(projects.id, importBatches.projectId))
        .where(eq(sourceItems.id, sourceItemId))

      if (!projectRow) throw new Error(`Cannot resolve project for sourceItem ${sourceItemId}`)

      const { projectId, threshold } = projectRow
      const confidenceThreshold = parseFloat(threshold ?? '0.800')

      // Load active categories for this project
      const projectCategories = await db
        .select({ id: categories.id, name: categories.name, fullPath: categories.fullPath, active: categories.active })
        .from(categories)
        .where(eq(categories.projectId, projectId))
        .then(rows => rows.filter(c => c.active))

      if (projectCategories.length === 0) {
        await insertValidationIssue({
          productDraftId,
          code: 'NO_CATEGORIES_AVAILABLE',
          severity: 'WARNING',
          message: 'Project has no categories — skipping categorization',
        })
        await updateDraftCategory(productDraftId, { status: 'PROCESSING_IMAGES' })
        await calculatePriceQueue.add('calculate-price', { sourceItemId, productDraftId })
        return { productDraftId, outcome: 'SKIPPED', reason: 'NO_CATEGORIES' }
      }

      const facts = await db
        .select({ fieldName: productFacts.fieldName, normalizedValue: productFacts.normalizedValue })
        .from(productFacts)
        .where(eq(productFacts.productDraftId, productDraftId))

      const result = await categorizeProduct(
        {
          title: draft.titleCs,
          brand: draft.brand,
          productType: draft.productType,
          facts,
        },
        projectCategories,
      )

      const { data: cat, usage } = result

      console.log(
        `[categorize-product] draft=${productDraftId} confidence=${cat.confidence} tokens=${usage.inputTokens}+${usage.outputTokens}`,
      )

      // Verify returned category actually belongs to this project
      const matched = projectCategories.find(c => c.id === cat.primaryCategoryId)

      if (!matched) {
        await insertValidationIssue({
          productDraftId,
          code: 'CATEGORY_ID_UNKNOWN',
          severity: 'WARNING',
          message: `AI returned unknown category ID: ${cat.primaryCategoryId}`,
          details: { returnedId: cat.primaryCategoryId },
        })
        await updateDraftCategory(productDraftId, { status: 'PROCESSING_IMAGES' })
        await calculatePriceQueue.add('calculate-price', { sourceItemId, productDraftId })
        return { productDraftId, outcome: 'NEEDS_REVIEW', reason: 'CATEGORY_ID_UNKNOWN' }
      }

      if (cat.confidence < confidenceThreshold) {
        await insertValidationIssue({
          productDraftId,
          code: 'CATEGORY_LOW_CONFIDENCE',
          fieldName: 'categoryId',
          severity: 'WARNING',
          message: `Category confidence ${cat.confidence.toFixed(3)} below threshold ${confidenceThreshold}`,
          details: { confidence: cat.confidence, threshold: confidenceThreshold, reason: cat.reason },
        })
        await updateDraftCategory(productDraftId, {
          categoryId: cat.primaryCategoryId,
          categoryConfidence: cat.confidence,
          status: 'PROCESSING_IMAGES',
        })
        await calculatePriceQueue.add('calculate-price', { sourceItemId, productDraftId })
        return { productDraftId, outcome: 'NEEDS_REVIEW', reason: 'LOW_CONFIDENCE' }
      }

      await updateDraftCategory(productDraftId, {
        categoryId: cat.primaryCategoryId,
        categoryConfidence: cat.confidence,
        status: 'PROCESSING_IMAGES',
      })
      await calculatePriceQueue.add('calculate-price', { sourceItemId, productDraftId })

      return { productDraftId, outcome: 'CATEGORIZED', confidence: cat.confidence }
    },
    { connection, concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[categorize-product] job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job, result) => {
    console.log(`[categorize-product] job ${job.id} done — outcome=${result.outcome}`)
  })

  return worker
}
