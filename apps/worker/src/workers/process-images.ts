import { Worker, Queue, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import {
  db, productDrafts, productImages,
  insertValidationIssue, updateProductImage, updateDraftStatusAfterImages,
} from '@zalisto/database'
import { eq } from 'drizzle-orm'
import { createStorageClient } from '@zalisto/storage'
import { downloadImage } from '@zalisto/images'
import { processImage } from '@zalisto/images'
import { env } from '../env.js'

export interface ProcessImagesJobData {
  sourceItemId: string
  productDraftId: string
}

const MIN_DIMENSION = 200

export function startProcessImagesWorker(connection: Redis) {
  const validateQueue = new Queue('validate-product', { connection })

  const storage = createStorageClient({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  })

  const worker = new Worker<ProcessImagesJobData>(
    'process-images',
    async (job: Job<ProcessImagesJobData>) => {
      const { productDraftId } = job.data

      const [draft] = await db.select().from(productDrafts).where(eq(productDrafts.id, productDraftId))
      if (!draft) throw new Error(`productDraft ${productDraftId} not found`)

      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productDraftId, productDraftId))

      if (images.length === 0) {
        await insertValidationIssue({
          productDraftId,
          code: 'NO_IMAGES_FOUND',
          severity: 'WARNING',
          message: 'No images were found for this product',
        })
        await updateDraftStatusAfterImages(productDraftId, 'NEEDS_REVIEW')
        return { productDraftId, outcome: 'NO_IMAGES' }
      }

      let processedCount = 0
      let failedCount = 0

      for (const image of images) {
        try {
          const downloaded = await downloadImage(image.sourceUrl)
          const processed = await processImage(downloaded.buffer)

          const originalKey = `images/${productDraftId}/${image.id}/original`
          const webpKey = `images/${productDraftId}/${image.id}/webp.webp`

          await storage.put(originalKey, downloaded.buffer, downloaded.mimeType)
          await storage.put(webpKey, processed.webpBuffer, 'image/webp')

          const isTooSmall = processed.width < MIN_DIMENSION || processed.height < MIN_DIMENSION
          const status = isTooSmall ? 'TOO_SMALL' : 'PROCESSED'

          if (isTooSmall) {
            await insertValidationIssue({
              productDraftId,
              code: 'IMAGE_TOO_SMALL',
              severity: 'WARNING',
              message: `Image ${image.sourceUrl} is too small (${processed.width}×${processed.height}px, min ${MIN_DIMENSION}px)`,
              details: { imageId: image.id, width: processed.width, height: processed.height },
            })
          }

          await updateProductImage(image.id, {
            sourceHash: processed.hash,
            originalStorageKey: originalKey,
            webpStorageKey: webpKey,
            width: processed.width,
            height: processed.height,
            sizeBytes: processed.sizeBytes,
            status,
          })

          processedCount++
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn(`[process-images] failed image ${image.id}: ${message}`)

          await insertValidationIssue({
            productDraftId,
            code: 'IMAGE_DOWNLOAD_FAILED',
            severity: 'WARNING',
            message: `Failed to process image ${image.sourceUrl}: ${message}`,
            details: { imageId: image.id, error: message },
          })

          await db.update(productImages)
            .set({ status: 'FAILED' })
            .where(eq(productImages.id, image.id))

          failedCount++
        }
      }

      if (processedCount === 0) {
        await insertValidationIssue({
          productDraftId,
          code: 'ALL_IMAGES_FAILED',
          severity: 'ERROR',
          message: 'All images failed to process',
          details: { total: images.length, failed: failedCount },
        })
      }

      await updateDraftStatusAfterImages(productDraftId, 'VALIDATING')

      await validateQueue.add('validate-product', { sourceItemId: job.data.sourceItemId, productDraftId })

      console.log(
        `[process-images] draft=${productDraftId} processed=${processedCount} failed=${failedCount} → enqueued validate-product`,
      )

      return { productDraftId, outcome: 'VALIDATING', processedCount, failedCount }
    },
    { connection, concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[process-images] job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job, result) => {
    console.log(`[process-images] job ${job.id} done — outcome=${result.outcome}`)
  })

  return worker
}
