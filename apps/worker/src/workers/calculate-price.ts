import { Worker, Queue, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import {
  db, productDrafts, productFacts, projects,
  sourceItems, importBatches,
  insertValidationIssue, updateDraftPrice,
} from '@zalisto/database'
import { eq } from 'drizzle-orm'
import { calculatePrice } from '@zalisto/pricing'
import type { PricingConfig } from '@zalisto/domain'
import { bestFactValue } from '../lib/facts.js'

export interface CalculatePriceJobData {
  sourceItemId: string
  productDraftId: string
}

export function startCalculatePriceWorker(connection: Redis) {
  const processImagesQueue = new Queue('process-images', { connection })

  const worker = new Worker<CalculatePriceJobData>(
    'calculate-price',
    async (job: Job<CalculatePriceJobData>) => {
      const { productDraftId, sourceItemId } = job.data

      const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, productDraftId))
      if (!draft) throw new Error(`productDraft ${productDraftId} not found`)

      const facts = await db.select().from(productFacts).where(eq(productFacts.productDraftId, productDraftId))

      const [projectRow] = await db
        .select({ pricingConfig: projects.pricingConfig })
        .from(sourceItems)
        .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
        .innerJoin(projects, eq(projects.id, importBatches.projectId))
        .where(eq(sourceItems.id, sourceItemId))

      if (!projectRow) throw new Error(`Cannot resolve project for sourceItem ${sourceItemId}`)

      const pricingConfig = projectRow.pricingConfig as PricingConfig

      const rawPrice = draft.sourcePrice ? parseFloat(draft.sourcePrice) : null
      const sourcePriceNum = rawPrice ?? (bestFactValue(facts, 'price') ? parseFloat(bestFactValue(facts, 'price')!) : null)
      const sourceCurrency = bestFactValue(facts, 'currency') ?? pricingConfig.targetCurrency

      const result = calculatePrice(sourcePriceNum, sourceCurrency, pricingConfig)

      if (!result.ok) {
        if (result.reason === 'VAT_STATUS_UNKNOWN') {
          await insertValidationIssue({
            productDraftId,
            code: 'PRICE_VAT_STATUS_UNKNOWN',
            fieldName: 'sourcePrice',
            severity: 'BLOCKER',
            message: 'Cannot calculate price: VAT inclusion status not configured for this project',
          })
          await db.update(productDrafts)
            .set({ status: 'BLOCKED' })
            .where(eq(productDrafts.id, productDraftId))
          return { productDraftId, outcome: 'BLOCKED', reason: 'VAT_STATUS_UNKNOWN' }
        }

        if (result.reason === 'NO_PRICE') {
          await insertValidationIssue({
            productDraftId,
            code: 'PRICE_NOT_FOUND',
            fieldName: 'sourcePrice',
            severity: 'WARNING',
            message: 'No source price found — product will be exported without price',
          })
        }

        if (result.reason === 'INVALID_CONFIG') {
          await insertValidationIssue({
            productDraftId,
            code: 'PRICE_INVALID_CONFIG',
            severity: 'ERROR',
            message: 'Pricing configuration is invalid (negative exchange rate, VAT, or margin)',
          })
        }

        // Continue to image processing even without price
        await processImagesQueue.add('process-images', { sourceItemId, productDraftId })
        return { productDraftId, outcome: 'SKIPPED', reason: result.reason }
      }

      await updateDraftPrice(productDraftId, {
        targetPrice: result.breakdown.finalPrice,
        pricingBreakdown: result.breakdown as unknown as Record<string, unknown>,
        status: 'PROCESSING_IMAGES',
      })

      await processImagesQueue.add('process-images', { sourceItemId, productDraftId })

      console.log(
        `[calculate-price] draft=${productDraftId} finalPrice=${result.breakdown.finalPrice} ${result.breakdown.targetCurrency}`,
      )

      return { productDraftId, outcome: 'CALCULATED', finalPrice: result.breakdown.finalPrice }
    },
    { connection, concurrency: 5 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[calculate-price] job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job, result) => {
    console.log(`[calculate-price] job ${job.id} done — outcome=${result.outcome}`)
  })

  return worker
}
