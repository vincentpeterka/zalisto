import { Worker, Queue, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import { db, sourceItems, importBatches } from '@zalisto/database'
import { eq, sql } from 'drizzle-orm'
import { createStorageClient } from '@zalisto/storage'
import { fetchPage } from '../lib/fetcher.js'
import { env } from '../env.js'

export interface FetchSourceJobData {
  sourceItemId: string
  url: string
  batchId: string
}

export function startFetchSourceWorker(connection: Redis) {
  const extractQueue = new Queue('extract-product', { connection })

  const storage = createStorageClient({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
  })

  const worker = new Worker<FetchSourceJobData>(
    'fetch-source',
    async (job: Job<FetchSourceJobData>) => {
      const { sourceItemId, url, batchId } = job.data

      await db.update(sourceItems)
        .set({ fetchStatus: 'FETCHING' })
        .where(eq(sourceItems.id, sourceItemId))

      let result
      try {
        result = await fetchPage(url)
      } catch (err) {
        await db.update(sourceItems).set({
          fetchStatus: 'FAILED',
          httpStatus: null,
          fetchedAt: new Date(),
        }).where(eq(sourceItems.id, sourceItemId))

        await db.update(importBatches)
          .set({ failedItems: sql`${importBatches.failedItems} + 1` })
          .where(eq(importBatches.id, batchId))

        throw err
      }

      const storageKey = `raw-html/${batchId}/${sourceItemId}.html`
      await storage.put(storageKey, result.rawBytes, 'text/html; charset=utf-8')

      await db.update(sourceItems).set({
        fetchStatus: 'DONE',
        httpStatus: result.statusCode,
        contentHash: result.hash,
        rawHtmlStorageKey: storageKey,
        fetchedAt: new Date(),
      }).where(eq(sourceItems.id, sourceItemId))

      await db.update(importBatches).set({
        processedItems: sql`${importBatches.processedItems} + 1`,
      }).where(eq(importBatches.id, batchId))

      await extractQueue.add('extract-product', { sourceItemId, batchId })
    },
    {
      connection,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[fetch-source] job ${job?.id} failed:`, err.message)
  })

  return worker
}
