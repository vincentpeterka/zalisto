import {
  pgTable, text, uuid, timestamp, numeric, jsonb, boolean, integer,
} from 'drizzle-orm/pg-core'
import { sourceItems } from './batches.js'
import { categories } from './projects.js'
import { users } from './users.js'

const PRODUCT_STATUS = [
  'PENDING','FETCHING','EXTRACTING','IDENTIFYING','ENRICHING',
  'GENERATING_CONTENT','PROCESSING_IMAGES','VALIDATING',
  'READY_FOR_REVIEW','NEEDS_REVIEW','BLOCKED',
  'APPROVED','EXPORTED','FAILED',
] as const

export const productDrafts = pgTable('product_drafts', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  sourceItemId:           uuid('source_item_id').notNull().unique().references(() => sourceItems.id, { onDelete: 'cascade' }),
  status:                 text('status', { enum: PRODUCT_STATUS }).notNull().default('PENDING'),
  brand:                  text('brand'),
  modelName:              text('model_name'),
  manufacturerPartNumber: text('manufacturer_part_number'),
  gtin:                   text('gtin'),
  productType:            text('product_type'),
  titleCs:                text('title_cs'),
  shortDescriptionCs:     text('short_description_cs'),
  longDescriptionCs:      text('long_description_cs'),
  bulletPointsCs:         jsonb('bullet_points_cs'),
  aiUsedFactIds:          jsonb('ai_used_fact_ids'),
  sourcePrice:            numeric('source_price', { precision: 14, scale: 4 }),
  targetPrice:            numeric('target_price', { precision: 14, scale: 2 }),
  currency:               text('currency'),
  pricingBreakdown:       jsonb('pricing_breakdown'),
  categoryId:             uuid('category_id').references(() => categories.id),
  categoryConfidence:     numeric('category_confidence', { precision: 5, scale: 4 }),
  overallConfidence:      numeric('overall_confidence', { precision: 5, scale: 4 }),
  reviewRequired:         boolean('review_required').notNull().default(true),
  approvedAt:             timestamp('approved_at', { withTimezone: true }),
  approvedBy:             uuid('approved_by').references(() => users.id),
  failedReason:           text('failed_reason'),
  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

const SOURCE_TYPE = [
  'MANUFACTURER','AUTHORIZED_DISTRIBUTOR','SUPPLIER','GS1',
  'LICENSED_DATABASE','SOURCE_PAGE','RETAILER','AI_INFERENCE','USER_INPUT',
] as const

export const productFacts = pgTable('product_facts', {
  id:              uuid('id').primaryKey().defaultRandom(),
  productDraftId:  uuid('product_draft_id').notNull().references(() => productDrafts.id, { onDelete: 'cascade' }),
  fieldName:       text('field_name').notNull(),
  valueJson:       jsonb('value_json').notNull(),
  normalizedValue: text('normalized_value'),
  sourceType:      text('source_type', { enum: SOURCE_TYPE }).notNull(),
  sourceUrl:       text('source_url'),
  confidence:      numeric('confidence', { precision: 5, scale: 4 }),
  isSelected:      boolean('is_selected').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const productVariants = pgTable('product_variants', {
  id:              uuid('id').primaryKey().defaultRandom(),
  productDraftId:  uuid('product_draft_id').notNull().references(() => productDrafts.id, { onDelete: 'cascade' }),
  variantKey:      text('variant_key').notNull(),
  sku:             text('sku'),
  gtin:            text('gtin'),
  optionValues:    jsonb('option_values').notNull().default('{}'),
  sourcePrice:     numeric('source_price', { precision: 14, scale: 4 }),
  targetPrice:     numeric('target_price', { precision: 14, scale: 2 }),
  stockText:       text('stock_text'),
  active:          boolean('active').notNull().default(true),
})

export const productImages = pgTable('product_images', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  productDraftId:      uuid('product_draft_id').notNull().references(() => productDrafts.id, { onDelete: 'cascade' }),
  variantId:           uuid('variant_id').references(() => productVariants.id),
  sourceUrl:           text('source_url').notNull(),
  sourceHash:          text('source_hash'),
  originalStorageKey:  text('original_storage_key'),
  webpStorageKey:      text('webp_storage_key'),
  width:               integer('width'),
  height:              integer('height'),
  sizeBytes:           integer('size_bytes'),
  sortOrder:           integer('sort_order').notNull().default(0),
  rightsConfirmed:     boolean('rights_confirmed').notNull().default(false),
  status:              text('status', { enum: ['PENDING','PROCESSED','TOO_SMALL','FAILED'] }).notNull().default('PENDING'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
