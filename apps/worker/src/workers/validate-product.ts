import { Worker, type Job } from 'bullmq'
import { workerLogger } from '../lib/logger.js'
import { Redis } from 'ioredis'
import {
  db, productDrafts, productFacts, productImages, validationIssues,
  insertValidationIssue,
} from '@zalisto/database'
import { eq, sql } from 'drizzle-orm'
import { validateDraft } from '@zalisto/validation'
import type { DraftSnapshot, FactSnapshot, ImageSnapshot, ExistingIssue } from '@zalisto/validation'

export interface ValidateProductJobData {
  sourceItemId: string
  productDraftId: string
}

export function startValidateProductWorker(connection: Redis) {
  const log = workerLogger('validate-product')
  const worker = new Worker<ValidateProductJobData>(
    'validate-product',
    async (job: Job<ValidateProductJobData>) => {
      const { productDraftId } = job.data

      const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, productDraftId))
      if (!draft) throw new Error(`productDraft ${productDraftId} not found`)

      const facts = await db
        .select({ id: productFacts.id, fieldName: productFacts.fieldName, isSelected: productFacts.isSelected })
        .from(productFacts)
        .where(eq(productFacts.productDraftId, productDraftId))

      const images = await db
        .select({ id: productImages.id, status: productImages.status, rightsConfirmed: productImages.rightsConfirmed })
        .from(productImages)
        .where(eq(productImages.productDraftId, productDraftId))

      const existing = await db
        .select({ code: validationIssues.code, severity: validationIssues.severity, resolved: validationIssues.resolved })
        .from(validationIssues)
        .where(eq(validationIssues.productDraftId, productDraftId))

      const draftSnapshot: DraftSnapshot = {
        id: draft.id,
        status: draft.status,
        brand: draft.brand,
        modelName: draft.modelName,
        manufacturerPartNumber: draft.manufacturerPartNumber,
        gtin: draft.gtin,
        titleCs: draft.titleCs,
        shortDescriptionCs: draft.shortDescriptionCs,
        longDescriptionCs: draft.longDescriptionCs,
        targetPrice: draft.targetPrice,
        categoryId: draft.categoryId,
        categoryConfidence: draft.categoryConfidence,
      }

      const factSnapshots: FactSnapshot[] = facts.map(f => ({
        id: f.id,
        fieldName: f.fieldName,
        isSelected: f.isSelected,
      }))

      const imageSnapshots: ImageSnapshot[] = images.map(i => ({
        id: i.id,
        status: i.status,
        rightsConfirmed: i.rightsConfirmed,
      }))

      const existingIssues: ExistingIssue[] = existing.map(e => ({
        code: e.code,
        severity: e.severity,
        resolved: e.resolved,
      }))

      const { violations, finalStatus } = validateDraft(draftSnapshot, factSnapshots, imageSnapshots, existingIssues)

      for (const v of violations) {
        await insertValidationIssue({
          productDraftId,
          code: v.code,
          fieldName: v.fieldName,
          severity: v.severity,
          message: v.message,
          details: v.details ?? {},
        })
      }

      await db.update(productDrafts)
        .set({ status: finalStatus, updatedAt: sql`now()` })
        .where(eq(productDrafts.id, productDraftId))

      log.info(
        `[validate-product] draft=${productDraftId} newViolations=${violations.length} status=${finalStatus}`,
      )

      return { productDraftId, violations: violations.length, finalStatus }
    },
    { connection, concurrency: 5 },
  )

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'job failed')
  })

  worker.on('completed', (job, result) => {
    log.info(`[validate-product] job ${job.id} done — status=${result.finalStatus}`)
  })

  return worker
}
