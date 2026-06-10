import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) throw new Error('DATABASE_URL environment variable is required')

export const pool = postgres(connectionString, { max: 10 })
export const db = drizzle(pool, { schema })
