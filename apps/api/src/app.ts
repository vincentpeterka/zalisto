import Fastify, { type FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import { env } from './lib/env.js'
import authPlugin from './plugins/auth.js'
import orgsPlugin from './plugins/organizations.js'
import projectsPlugin from './plugins/projects.js'
import batchesPlugin from './plugins/batches.js'
import productsPlugin from './plugins/products.js'

export async function createApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
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

  fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

  await fastify.register(authPlugin)
  await fastify.register(orgsPlugin)
  await fastify.register(projectsPlugin)
  await fastify.register(batchesPlugin)
  await fastify.register(productsPlugin)

  return fastify
}
