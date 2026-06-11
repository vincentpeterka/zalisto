import fp from 'fastify-plugin'
import { type FastifyInstance } from 'fastify'
import { env } from '../lib/env.js'

export default fp(async function sentryPlugin(fastify: FastifyInstance) {
  if (!env.SENTRY_DSN) return

  // Dynamic import so @sentry/node is not loaded when SENTRY_DSN is absent.
  // @sentry/node requires Node 19+ API (tracingChannel) at module load time.
  const Sentry = await import('@sentry/node')

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  })

  fastify.addHook('onError', async (_req, _reply, error) => {
    Sentry.captureException(error)
  })

  fastify.addHook('onClose', async () => {
    await Sentry.close(2000)
  })
})
