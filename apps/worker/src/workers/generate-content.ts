import { Worker, Queue, type Job } from 'bullmq'
import { workerLogger } from '../lib/logger.js'
import { Redis } from 'ioredis'
import { db, productDrafts, productFacts, projects, sourceItems, importBatches, updateDraftContent, insertValidationIssue } from '@zalisto/database'
import { eq, and } from 'drizzle-orm'
import { generateContent } from '@zalisto/ai'

export interface GenerateContentJobData {
  sourceItemId: string
  productDraftId: string
}

export function startGenerateContentWorker(connection: Redis) {
  const log = workerLogger('generate-content')
  const categorizeQueue = new Queue('categorize-product', { connection })

  const worker = new Worker<GenerateContentJobData>(
    'generate-content',
    async (job: Job<GenerateContentJobData>) => {
      const { productDraftId, sourceItemId } = job.data

      const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, productDraftId))
      if (!draft) throw new Error(`productDraft ${productDraftId} not found`)

      // Resolve project for text_style_config
      const [row] = await db
        .select({ textStyleConfig: projects.textStyleConfig })
        .from(sourceItems)
        .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
        .innerJoin(projects, eq(projects.id, importBatches.projectId))
        .where(eq(sourceItems.id, sourceItemId))

      const textStyleConfig = (row?.textStyleConfig as Record<string, unknown>) ?? {}

      // Load selected facts only
      const facts = await db
        .select()
        .from(productFacts)
        .where(and(
          eq(productFacts.productDraftId, productDraftId),
          eq(productFacts.isSelected, true),
        ))

      if (facts.length === 0) {
        // No selected facts — use all facts as fallback
        const allFacts = await db.select().from(productFacts).where(eq(productFacts.productDraftId, productDraftId))
        if (allFacts.length === 0) {
          await insertValidationIssue({
            productDraftId,
            code: 'NO_FACTS_FOR_CONTENT',
            severity: 'ERROR',
            message: 'No product facts available for content generation',
          })
          await updateDraftContent(productDraftId, { status: 'NEEDS_REVIEW' })
          return { productDraftId, outcome: 'NEEDS_REVIEW', reason: 'NO_FACTS' }
        }
        facts.push(...allFacts)
      }

      const aiInput = facts.map(f => ({
        id: f.id,
        fieldName: f.fieldName,
        normalizedValue: f.normalizedValue,
        valueJson: f.valueJson,
        confidence: f.confidence,
      }))

      const result = await generateContent(aiInput, textStyleConfig)
      const { data: content, usage } = result

      log.info(
        `[generate-content] draft=${productDraftId} tokens=${usage.inputTokens}+${usage.outputTokens} cost=$${usage.estimatedCostUsd.toFixed(4)}`,
      )

      // Warn if AI referenced facts not in our list (shouldn't happen with Structured Outputs, but guard anyway)
      const knownIds = new Set(facts.map(f => f.id))
      const unknownIds = content.usedFactIds.filter(id => !knownIds.has(id))
      if (unknownIds.length > 0) {
        await insertValidationIssue({
          productDraftId,
          code: 'AI_REFERENCED_UNKNOWN_FACT',
          severity: 'WARNING',
          message: `AI referenced unknown fact IDs: ${unknownIds.join(', ')}`,
          details: { unknownIds },
        })
      }

      await updateDraftContent(productDraftId, {
        titleCs: content.titleCs,
        shortDescriptionCs: content.shortDescriptionCs,
        longDescriptionCs: content.longDescriptionCs,
        bulletPointsCs: content.bulletPoints,
        aiUsedFactIds: content.usedFactIds,
      })

      await categorizeQueue.add('categorize-product', { sourceItemId, productDraftId })

      return { productDraftId, outcome: 'CONTENT_GENERATED' }
    },
    { connection, concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'job failed')
  })

  worker.on('completed', (job, result) => {
    log.info(`[generate-content] job ${job.id} done — outcome=${result.outcome}`)
  })

  return worker
}
