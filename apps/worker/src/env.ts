import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://localhost:9000',
  S3_BUCKET: process.env['S3_BUCKET'] ?? 'zalisto',
  S3_ACCESS_KEY: process.env['S3_ACCESS_KEY'] ?? 'minioadmin',
  S3_SECRET_KEY: process.env['S3_SECRET_KEY'] ?? 'minioadmin',
  S3_REGION: process.env['S3_REGION'] ?? 'us-east-1',
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
}
