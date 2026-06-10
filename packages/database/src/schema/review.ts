import { pgTable, text, uuid, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core'
import { productDrafts } from './products.js'
import { importBatches } from './batches.js'
import { users } from './users.js'
import { organizations } from './organizations.js'

export const validationIssues = pgTable('validation_issues', {
  id:              uuid('id').primaryKey().defaultRandom(),
  productDraftId:  uuid('product_draft_id').notNull().references(() => productDrafts.id, { onDelete: 'cascade' }),
  code:            text('code').notNull(),
  fieldName:       text('field_name'),
  severity:        text('severity', { enum: ['INFO','WARNING','ERROR','BLOCKER'] }).notNull(),
  message:         text('message').notNull(),
  details:         jsonb('details').notNull().default('{}'),
  resolved:        boolean('resolved').notNull().default(false),
  resolvedBy:      uuid('resolved_by').references(() => users.id),
  resolvedAt:      timestamp('resolved_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reviewDecisions = pgTable('review_decisions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  productDraftId:  uuid('product_draft_id').notNull().references(() => productDrafts.id, { onDelete: 'cascade' }),
  userId:          uuid('user_id').notNull().references(() => users.id),
  action:          text('action').notNull(),
  fieldName:       text('field_name'),
  oldValue:        jsonb('old_value'),
  newValue:        jsonb('new_value'),
  note:            text('note'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const exports = pgTable('exports', {
  id:           uuid('id').primaryKey().defaultRandom(),
  batchId:      uuid('batch_id').notNull().references(() => importBatches.id, { onDelete: 'cascade' }),
  format:       text('format', { enum: ['SHOPTET_XLSX','CSV','ZIP'] }).notNull(),
  storageKey:   text('storage_key').notNull(),
  productCount: integer('product_count').notNull(),
  createdBy:    uuid('created_by').notNull().references(() => users.id),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditEvents = pgTable('audit_events', {
  id:             uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorUserId:    uuid('actor_user_id').references(() => users.id),
  eventType:      text('event_type').notNull(),
  entityType:     text('entity_type').notNull(),
  entityId:       uuid('entity_id'),
  payload:        jsonb('payload').notNull().default('{}'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
