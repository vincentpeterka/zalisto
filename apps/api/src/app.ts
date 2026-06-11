import Fastify, { type FastifyInstance, type FastifyLoggerOptions } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import { env } from './lib/env.js'
import authPlugin from './plugins/auth.js'
import orgsPlugin from './plugins/organizations.js'
import projectsPlugin from './plugins/projects.js'
import batchesPlugin from './plugins/batches.js'
import productsPlugin from './plugins/products.js'
import exportsPlugin from './plugins/exports.js'
import sentryPlugin from './plugins/sentry.js'

const QUEUE_NAMES = [
  'fetch-source', 'extract-product', 'identify-product',
  'generate-content', 'categorize-product', 'calculate-price',
  'process-images', 'validate-product', 'generate-export',
]

export async function createApp(opts: { logger?: boolean | FastifyLoggerOptions } = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: opts.logger ?? false })

  await fastify.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  })

  await fastify.register(fastifyCookie)
  await fastify.register(fastifySession, {
    secret: env.SESSION_SECRET,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })

  await fastify.register(sentryPlugin)

  fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

  // Bull-board queue dashboard — only when REDIS_URL is reachable (skip in test env)
  if (env.NODE_ENV !== 'test') {
    try {
      const { createBullBoard } = await import('@bull-board/api')
      const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter.js')
      const { FastifyAdapter } = await import('@bull-board/fastify')
      const { Queue } = await import('bullmq')
      const { Redis } = await import('ioredis')

      const bullRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true })
      bullRedis.on('error', () => { /* suppress background connection errors */ })
      const queues = QUEUE_NAMES.map(name => new BullMQAdapter(new Queue(name, { connection: bullRedis as any })))
      const serverAdapter = new FastifyAdapter()
      createBullBoard({ queues: queues as any, serverAdapter: serverAdapter as any })
      serverAdapter.setBasePath('/admin/queues')
      await fastify.register(serverAdapter.registerPlugin() as any, { prefix: '/admin/queues', basePath: '/admin/queues' })
    } catch (err) {
      fastify.log.warn({ err }, 'Bull-board not available — skipping queue dashboard')
    }
  }

  await fastify.register(authPlugin)
  await fastify.register(orgsPlugin)
  await fastify.register(projectsPlugin)
  await fastify.register(batchesPlugin)
  await fastify.register(productsPlugin)
  await fastify.register(exportsPlugin)

  return fastify
}
