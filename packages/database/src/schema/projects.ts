import { pgTable, text, uuid, timestamp, numeric, jsonb, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.js'

export const projects = pgTable('projects', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  organizationId:             uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name:                       text('name').notNull(),
  targetLanguage:             text('target_language').notNull().default('cs'),
  targetCurrency:             text('target_currency').notNull().default('CZK'),
  vatRate:                    numeric('vat_rate', { precision: 5, scale: 2 }),
  pricingConfig:              jsonb('pricing_config').notNull().default('{}'),
  textStyleConfig:            jsonb('text_style_config').notNull().default('{}'),
  imageConfig:                jsonb('image_config').notNull().default('{}'),
  categoryConfidenceThreshold: numeric('category_confidence_threshold', { precision: 4, scale: 3 }).notNull().default('0.800'),
  createdAt:                  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const categories = pgTable('categories', {
  id:         uuid('id').primaryKey().defaultRandom(),
  projectId:  uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),
  name:       text('name').notNull(),
  fullPath:   text('full_path').notNull(),
  parentId:   uuid('parent_id'),  // self-reference — set up manually in migrations
  active:     boolean('active').notNull().default(true),
})
