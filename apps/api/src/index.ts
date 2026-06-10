import { createApp } from './app.js'
import { env } from './lib/env.js'

const fastify = await createApp({ logger: true })

try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
