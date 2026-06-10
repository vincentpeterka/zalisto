import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://zalisto:zalisto@localhost:5432/zalisto',
  },
  verbose: true,
  strict: true,
} satisfies Config
