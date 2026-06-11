import { createApp } from './app.js'
import { env } from './lib/env.js'

const isDev = env.NODE_ENV !== 'production'
const fastify = await createApp({
  logger: {
    level: env.LOG_LEVEL,
    ...(isDev ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
  },
})

try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
