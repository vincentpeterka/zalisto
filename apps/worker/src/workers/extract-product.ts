import { Worker, Queue, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { db, sourceItems, productDrafts, insertProductDraftWithFacts } from '@zalisto/database'
import { eq } from 'drizzle-orm'
import { createStorageClient } from '@zalisto/storage'
import { extractProduct } from '@zalisto/extraction'
import { env } from '../env.js'

export interface ExtractProductJobData {
  sourceItemId: string
  batchId: string
}

export function startExtractProductWorker(connection: Redis) {
  const storage = createStorageClient({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  })

  const browserExtractQueue = new Queue('browser-extract', { connection })
  const identifyQueue = new Queue('identify-product', { connection })

  const worker = new Worker<ExtractProductJobData>(
    'extract-product',
    async (job: Job<ExtractProductJobData>) => {
      const { sourceItemId, batchId: _batchId } = job.data

      const [item] = await db.select().from(sourceItems).where(eq(sourceItems.id, sourceItemId))
      if (!item) throw new Error(`sourceItem ${sourceItemId} not found`)
      if (!item.rawHtmlStorageKey) throw new Error(`sourceItem ${sourceItemId} has no rawHtmlStorageKey`)

      const htmlBytes = await storage.get(item.rawHtmlStorageKey)
      const html = htmlBytes.toString('utf-8')

      const extraction = extractProduct(html, item.sourceUrl)

      const productDraftId = await insertProductDraftWithFacts({
        sourceItemId,
        sourceUrl: item.sourceUrl,
        extraction,
      })

      if (extraction.needsBrowserFallback) {
        await db.update(productDrafts)
          .set({ status: 'PENDING' })
          .where(eq(productDrafts.id, productDraftId))
        await browserExtractQueue.add('browser-extract', { sourceItemId, productDraftId })
      } else {
        await db.update(productDrafts)
          .set({ status: 'IDENTIFYING' })
          .where(eq(productDrafts.id, productDraftId))
        await identifyQueue.add('identify-product', { sourceItemId, productDraftId })
      }

      return { productDraftId, confidence: extraction.confidence, needsBrowserFallback: extraction.needsBrowserFallback }
    },
    {
      connection,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[extract-product] job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job, result) => {
    console.log(`[extract-product] job ${job.id} done — confidence=${result.confidence.toFixed(2)} fallback=${result.needsBrowserFallback}`)
  })

  return worker
}
