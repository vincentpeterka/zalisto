import { Redis } from 'ioredis'
import { env } from './env.js'
import { startFetchSourceWorker } from './workers/fetch-source.js'
import { startExtractProductWorker } from './workers/extract-product.js'
import { startIdentifyProductWorker } from './workers/identify-product.js'
import { startGenerateContentWorker } from './workers/generate-content.js'
import { startCategorizeProductWorker } from './workers/categorize-product.js'

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

const workers = [
  startFetchSourceWorker(redis),
  startExtractProductWorker(redis),
  startIdentifyProductWorker(redis),
  startGenerateContentWorker(redis),
  startCategorizeProductWorker(redis),
]

console.log(`[worker] started ${workers.length} worker(s)`)

const shutdown = async () => {
  console.log('[worker] shutting down...')
  await Promise.all(workers.map(w => w.close()))
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
