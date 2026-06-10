import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// Walk up to monorepo root (.env lives there)
config({ path: resolve(__dirname, '../../../../.env') })

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const env = {
  PORT: parseInt(process.env['PORT'] ?? '3001', 10),
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
}
