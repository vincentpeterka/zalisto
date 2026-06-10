import { Worker, Queue, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import {
  db,
  productDrafts,
  productFacts,
  sourceItems,
  importBatches,
  insertValidationIssue,
  updateDraftIdentity,
  findDraftByGtinInProject,
  findDraftByBrandMpnInProject,
} from '@zalisto/database'
import { eq } from 'drizzle-orm'
import { validateGtin, normalizeMpn, normalizeBrand } from '@zalisto/identity'
import { bestFactValue } from '../lib/facts.js'

export interface IdentifyProductJobData {
  sourceItemId: string
  productDraftId: string
}

export function startIdentifyProductWorker(connection: Redis) {
  const generateContentQueue = new Queue('generate-content', { connection })

  const worker = new Worker<IdentifyProductJobData>(
    'identify-product',
    async (job: Job<IdentifyProductJobData>) => {
      const { productDraftId, sourceItemId } = job.data

      // Load draft + facts + project context
      const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, productDraftId))
      if (!draft) throw new Error(`productDraft ${productDraftId} not found`)

      const facts = await db.select().from(productFacts).where(eq(productFacts.productDraftId, productDraftId))

      // Resolve projectId via source_item → batch
      const [item] = await db
        .select({ projectId: importBatches.projectId })
        .from(sourceItems)
        .innerJoin(importBatches, eq(importBatches.id, sourceItems.batchId))
        .where(eq(sourceItems.id, sourceItemId))

      if (!item) throw new Error(`sourceItem ${sourceItemId} not found or has no batch`)
      const { projectId } = item

      // --- GTIN validation ---
      const rawGtin = draft.gtin ?? bestFactValue(facts, 'gtin')
      let validatedGtin: string | null = null
      let gtinBlocked = false

      if (rawGtin) {
        const result = validateGtin(rawGtin)

        if (!result.valid) {
          await insertValidationIssue({
            productDraftId,
            code: 'GTIN_INVALID_CHECKSUM',
            fieldName: 'gtin',
            severity: 'BLOCKER',
            message: `GTIN "${rawGtin}" failed checksum validation (${result.error})`,
            details: { rawGtin, error: result.error, gtinType: result.type },
          })
          gtinBlocked = true
        } else {
          validatedGtin = result.normalized!

          // Check for GTIN conflict within project
          const conflictId = await findDraftByGtinInProject(projectId, validatedGtin, productDraftId)
          if (conflictId) {
            await insertValidationIssue({
              productDraftId,
              code: 'GTIN_CONFLICT',
              fieldName: 'gtin',
              severity: 'ERROR',
              message: `GTIN "${validatedGtin}" already exists in this project (draft ${conflictId})`,
              details: { validatedGtin, conflictingDraftId: conflictId },
            })
            await updateDraftIdentity(productDraftId, { gtin: validatedGtin, status: 'NEEDS_REVIEW' })
            return { productDraftId, outcome: 'NEEDS_REVIEW', reason: 'GTIN_CONFLICT' }
          }
        }
      }

      if (gtinBlocked) {
        await updateDraftIdentity(productDraftId, { status: 'BLOCKED' })
        return { productDraftId, outcome: 'BLOCKED', reason: 'GTIN_INVALID_CHECKSUM' }
      }

      // --- MPN + Brand normalization ---
      const rawMpn = draft.manufacturerPartNumber ?? bestFactValue(facts, 'mpn') ?? bestFactValue(facts, 'sku')
      const rawBrand = draft.brand ?? bestFactValue(facts, 'brand')

      const normalizedMpn = rawMpn ? normalizeMpn(rawMpn) : null
      const normalizedBrand = rawBrand ? normalizeBrand(rawBrand) : null

      // Check brand+MPN duplicate (warning, doesn't stop pipeline)
      if (normalizedBrand && normalizedMpn) {
        const dupeId = await findDraftByBrandMpnInProject(projectId, normalizedBrand, normalizedMpn, productDraftId)
        if (dupeId) {
          await insertValidationIssue({
            productDraftId,
            code: 'VARIANT_DUPLICATE_MPN',
            fieldName: 'manufacturerPartNumber',
            severity: 'WARNING',
            message: `Brand+MPN combination "${normalizedBrand} / ${normalizedMpn}" already exists in this project (draft ${dupeId})`,
            details: { normalizedBrand, normalizedMpn, conflictingDraftId: dupeId },
          })
        }
      }

      // Persist normalized identity fields + advance status
      await updateDraftIdentity(productDraftId, {
        gtin: validatedGtin,
        brand: normalizedBrand,
        manufacturerPartNumber: normalizedMpn,
        status: 'GENERATING_CONTENT',
      })

      await generateContentQueue.add('generate-content', { sourceItemId, productDraftId })

      return { productDraftId, outcome: 'GENERATING_CONTENT' }
    },
    {
      connection,
      concurrency: 5,
    },
  )

  worker.on('failed', (job, err) => {
    console.error(`[identify-product] job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job, result) => {
    console.log(`[identify-product] job ${job.id} done — outcome=${result.outcome}`)
  })

  return worker
}
