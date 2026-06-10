import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import { env } from './lib/env.js'
import authPlugin from './plugins/auth.js'
import orgsPlugin from './plugins/organizations.js'
import projectsPlugin from './plugins/projects.js'

const fastify = Fastify({ logger: true })

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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
})

fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

await fastify.register(authPlugin)
await fastify.register(orgsPlugin)
await fastify.register(projectsPlugin)

try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
