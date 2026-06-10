import { pgTable, text, uuid, timestamp, integer, numeric, jsonb } from 'drizzle-orm/pg-core'
import { projects } from './projects.js'
import { users } from './users.js'

export const importBatches = pgTable('import_batches', {
  id:             uuid('id').primaryKey().defaultRandom(),
  projectId:      uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  createdBy:      uuid('created_by').notNull().references(() => users.id),
  name:           text('name'),
  status:         text('status', { enum: ['PENDING','PROCESSING','COMPLETED','FAILED'] }).notNull().default('PENDING'),
  totalItems:     integer('total_items').notNull().default(0),
  processedItems: integer('processed_items').notNull().default(0),
  failedItems:    integer('failed_items').notNull().default(0),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt:    timestamp('completed_at', { withTimezone: true }),
})

export const sourceItems = pgTable('source_items', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  batchId:            uuid('batch_id').notNull().references(() => importBatches.id, { onDelete: 'cascade' }),
  sourceUrl:          text('source_url').notNull(),
  sourceSku:          text('source_sku'),
  sourceGtin:         text('source_gtin'),
  sourcePrice:        numeric('source_price', { precision: 14, scale: 4 }),
  inputPayload:       jsonb('input_payload').notNull().default('{}'),
  fetchStatus:        text('fetch_status', { enum: ['PENDING','FETCHING','DONE','FAILED'] }).notNull().default('PENDING'),
  httpStatus:         integer('http_status'),
  contentHash:        text('content_hash'),
  rawHtmlStorageKey:  text('raw_html_storage_key'),
  fetchedAt:          timestamp('fetched_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
