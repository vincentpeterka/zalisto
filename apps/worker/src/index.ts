import { Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from './lib/logger.js'
import { startFetchSourceWorker } from './workers/fetch-source.js'
import { startExtractProductWorker } from './workers/extract-product.js'
import { startIdentifyProductWorker } from './workers/identify-product.js'
import { startGenerateContentWorker } from './workers/generate-content.js'
import { startCategorizeProductWorker } from './workers/categorize-product.js'
import { startCalculatePriceWorker } from './workers/calculate-price.js'
import { startProcessImagesWorker } from './workers/process-images.js'
import { startValidateProductWorker } from './workers/validate-product.js'
import { startGenerateExportWorker } from './workers/generate-export.js'

// Lazy import so Node 18 is not affected (@sentry/node uses tracingChannel from Node 19+)
if (env.SENTRY_DSN) {
  const { init } = await import('@sentry/node')
  init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  })
}

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

const workers = [
  startFetchSourceWorker(redis),
  startExtractProductWorker(redis),
  startIdentifyProductWorker(redis),
  startGenerateContentWorker(redis),
  startCategorizeProductWorker(redis),
  startCalculatePriceWorker(redis),
  startProcessImagesWorker(redis),
  startValidateProductWorker(redis),
  startGenerateExportWorker(redis),
]

logger.info({ count: workers.length }, 'Workers started')

const shutdown = async () => {
  logger.info('Shutting down workers...')
  await Promise.all(workers.map(w => w.close()))
  await redis.quit()
  if (env.SENTRY_DSN) {
    const { close } = await import('@sentry/node')
    await close(2000)
  }
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
