import pino from 'pino'
import { env } from '../env.js'

const isDev = env.NODE_ENV !== 'production'

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
    : {}),
})

export function workerLogger(name: string) {
  return logger.child({ worker: name })
}
