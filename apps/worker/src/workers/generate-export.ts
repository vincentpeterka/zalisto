import { Worker, type Job } from 'bullmq'
import { workerLogger } from '../lib/logger.js'
import { Redis } from 'ioredis'
import {
  db,
  importBatches, sourceItems, productDrafts, productImages, productVariants,
  categories, projects, users, validationIssues,
  updateExportRecord,
} from '@zalisto/database'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { createStorageClient } from '@zalisto/storage'
import {
  buildShoptetXlsx, buildValidationReport, buildSourceReport,
  buildExportZip, buildManifest,
} from '@zalisto/export'
import type { ApprovedProduct, BlockedProduct, SourceReportRow, ZipImage } from '@zalisto/export'
import { env } from '../env.js'

export interface GenerateExportJobData {
  batchId: string
  exportId: string
  requestedBy: string
}

function slugify(str: string | null | undefined): string {
  return (str ?? 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function startGenerateExportWorker(connection: Redis) {
  const log = workerLogger('generate-export')
  const storage = createStorageClient({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  })

  const worker = new Worker<GenerateExportJobData>(
    'generate-export',
    async (job: Job<GenerateExportJobData>) => {
      const { batchId, exportId, requestedBy } = job.data

      await updateExportRecord(exportId, { status: 'PROCESSING' })

      // Load batch + project info
      const [batch] = await db.select().from(importBatches).where(eq(importBatches.id, batchId))
      if (!batch) throw new Error(`batch ${batchId} not found`)

      const [project] = await db.select().from(projects).where(eq(projects.id, batch.projectId))
      if (!project) throw new Error(`project ${batch.projectId} not found`)

      const [requester] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, requestedBy))

      // Load all APPROVED drafts for this batch
      const approvedRows = await db
        .select({
          draft: productDrafts,
          sourceUrl: sourceItems.sourceUrl,
          categoryFullPath: categories.fullPath,
        })
        .from(sourceItems)
        .innerJoin(productDrafts, eq(productDrafts.sourceItemId, sourceItems.id))
        .leftJoin(categories, eq(categories.id, productDrafts.categoryId))
        .where(and(
          eq(sourceItems.batchId, batchId),
          eq(productDrafts.status, 'APPROVED'),
        ))

      // Load all BLOCKED drafts for validation report
      const blockedRows = await db
        .select({
          draft: productDrafts,
          sourceUrl: sourceItems.sourceUrl,
        })
        .from(sourceItems)
        .innerJoin(productDrafts, eq(productDrafts.sourceItemId, sourceItems.id))
        .where(and(
          eq(sourceItems.batchId, batchId),
          eq(productDrafts.status, 'BLOCKED'),
        ))

      // Load all source items for source report
      const allItems = await db
        .select({
          sourceUrl: sourceItems.sourceUrl,
          draftId: productDrafts.id,
          titleCs: productDrafts.titleCs,
          status: productDrafts.status,
          gtin: productDrafts.gtin,
        })
        .from(sourceItems)
        .leftJoin(productDrafts, eq(productDrafts.sourceItemId, sourceItems.id))
        .where(eq(sourceItems.batchId, batchId))

      const approvedIds = approvedRows.map(r => r.draft.id)

      // Load images + variants for approved products
      const [allImages, allVariants] = await Promise.all([
        approvedIds.length > 0
          ? db.select().from(productImages)
              .where(and(
                inArray(productImages.productDraftId, approvedIds),
                eq(productImages.status, 'PROCESSED'),
              ))
              .orderBy(productImages.productDraftId, productImages.sortOrder)
          : Promise.resolve([]),
        approvedIds.length > 0
          ? db.select().from(productVariants)
              .where(inArray(productVariants.productDraftId, approvedIds))
          : Promise.resolve([]),
      ])

      // Load issues for blocked products
      const blockedIds = blockedRows.map(r => r.draft.id)
      const blockedIssues = blockedIds.length > 0
        ? await db.select().from(validationIssues)
            .where(inArray(validationIssues.productDraftId, blockedIds))
        : []

      // Group images and variants by draftId
      const imagesByDraft = new Map<string, typeof allImages>()
      for (const img of allImages) {
        const list = imagesByDraft.get(img.productDraftId) ?? []
        list.push(img)
        imagesByDraft.set(img.productDraftId, list)
      }

      const variantsByDraft = new Map<string, typeof allVariants>()
      for (const v of allVariants) {
        const list = variantsByDraft.get(v.productDraftId) ?? []
        list.push(v)
        variantsByDraft.set(v.productDraftId, list)
      }

      const issuesByDraft = new Map<string, typeof blockedIssues>()
      for (const issue of blockedIssues) {
        const list = issuesByDraft.get(issue.productDraftId) ?? []
        list.push(issue)
        issuesByDraft.set(issue.productDraftId, list)
      }

      // Download WebP images from S3 and build filename mapping
      const zipImages: ZipImage[] = []
      const imageFilenameMap = new Map<string, string>() // imageId → filename in ZIP

      let imageIndex = 0
      for (const row of approvedRows) {
        const draftImages = imagesByDraft.get(row.draft.id) ?? []
        for (const img of draftImages.sort((a, b) => a.sortOrder - b.sortOrder)) {
          if (!img.webpStorageKey) continue
          try {
            const buffer = await storage.get(img.webpStorageKey)
            const slug = slugify(`${row.draft.brand ?? ''}-${row.draft.titleCs ?? ''}`)
            const filename = `${slug}-${String(imageIndex + 1).padStart(2, '0')}.webp`
            zipImages.push({ filename, buffer })
            imageFilenameMap.set(img.id, `images/${filename}`)
            imageIndex++
          } catch (err) {
            log.warn(`[generate-export] skipping image ${img.id}: ${(err as Error).message}`)
          }
        }
      }

      // Build ApprovedProduct list
      const approvedProducts: ApprovedProduct[] = approvedRows.map(row => {
        const draftImages = imagesByDraft.get(row.draft.id) ?? []
        const draftVariants = variantsByDraft.get(row.draft.id) ?? []

        return {
          id: row.draft.id,
          titleCs: row.draft.titleCs,
          shortDescriptionCs: row.draft.shortDescriptionCs,
          longDescriptionCs: row.draft.longDescriptionCs,
          brand: row.draft.brand,
          manufacturerPartNumber: row.draft.manufacturerPartNumber,
          gtin: row.draft.gtin,
          targetPrice: row.draft.targetPrice,
          vatRate: project.vatRate,
          categoryFullPath: row.categoryFullPath ?? null,
          sourceUrl: row.sourceUrl,
          images: draftImages
            .filter(img => imageFilenameMap.has(img.id))
            .map(img => ({
              imageId: img.id,
              webpFilename: imageFilenameMap.get(img.id)!,
              sortOrder: img.sortOrder,
            })),
          variants: draftVariants.map(v => ({
            variantKey: v.variantKey,
            sku: v.sku,
            gtin: v.gtin,
            targetPrice: v.targetPrice,
            optionValues: (v.optionValues as Record<string, string>) ?? {},
          })),
        }
      })

      // Build BlockedProduct list
      const blockedProducts: BlockedProduct[] = blockedRows.map(row => {
        const issues = issuesByDraft.get(row.draft.id) ?? []
        return {
          id: row.draft.id,
          titleCs: row.draft.titleCs,
          brand: row.draft.brand,
          gtin: row.draft.gtin,
          sourceUrl: row.sourceUrl,
          blockerCodes: issues.filter(i => i.severity === 'BLOCKER').map(i => i.code),
          errorCodes: issues.filter(i => i.severity === 'ERROR').map(i => i.code),
        }
      })

      // Build source report rows
      const sourceRows: SourceReportRow[] = allItems.map(item => ({
        sourceUrl: item.sourceUrl,
        productId: item.draftId ?? '',
        title: item.titleCs ?? null,
        status: item.status ?? 'NOT_PROCESSED',
        gtin: item.gtin ?? null,
      }))

      // Build XLSX + CSVs
      const [xlsxBuffer, validationCsv, sourceCsv] = await Promise.all([
        buildShoptetXlsx(approvedProducts),
        Promise.resolve(buildValidationReport(blockedProducts)),
        Promise.resolve(buildSourceReport(sourceRows)),
      ])

      const manifest = buildManifest({
        batchId,
        exportId,
        approvedCount: approvedProducts.length,
        blockedCount: blockedProducts.length,
        imageCount: zipImages.length,
        exportedBy: requester?.email ?? requestedBy,
      })

      const zipBuffer = await buildExportZip(
        xlsxBuffer,
        zipImages,
        [
          { filename: 'validation-report.csv', buffer: validationCsv },
          { filename: 'source-report.csv', buffer: sourceCsv },
        ],
        manifest,
      )

      const storageKey = `exports/${batchId}/${exportId}.zip`
      await storage.put(storageKey, zipBuffer, 'application/zip')

      await updateExportRecord(exportId, {
        status: 'READY',
        storageKey,
        productCount: approvedProducts.length,
      })

      // Update approved drafts status to EXPORTED
      if (approvedIds.length > 0) {
        await db.update(productDrafts)
          .set({ status: 'EXPORTED', updatedAt: sql`now()` })
          .where(inArray(productDrafts.id, approvedIds))
      }

      log.info(
        `[generate-export] export=${exportId} approved=${approvedProducts.length} ` +
        `blocked=${blockedProducts.length} images=${zipImages.length} → ${storageKey}`,
      )

      return { exportId, storageKey, approvedCount: approvedProducts.length }
    },
    { connection, concurrency: 2 },
  )

  worker.on('failed', async (job, err) => {
    log.error({ jobId: job?.id, err }, 'job failed')
    if (job?.data.exportId) {
      await updateExportRecord(job.data.exportId, { status: 'FAILED' }).catch(() => {})
    }
  })

  worker.on('completed', (job, result) => {
    log.info(`[generate-export] job ${job.id} done — approved=${result.approvedCount}`)
  })

  return worker
}
