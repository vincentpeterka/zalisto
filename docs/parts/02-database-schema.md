# Part: Database Schema (`packages/database`)

## Účel
Drizzle ORM schéma, migrace a query helpers. Vše co se týká PostgreSQL struktury je zde.

## Tabulky (16)

```
users                   — id, email, display_name, password_hash
organizations           — id, name
organization_members    — organization_id, user_id, role
projects                — id, org_id, name, target_language, currency, pricing_config, text_style_config, image_config
categories              — id, project_id, external_id, name, full_path, parent_id
import_batches          — id, project_id, created_by, name, status, total/processed/failed counts
source_items            — id, batch_id, source_url, source_sku, source_gtin, fetch_status, raw_html_storage_key
product_drafts          — id, source_item_id, status, brand, model_name, MPN, gtin, title_cs, descriptions, prices, category_id, confidence
product_facts           — id, product_draft_id, field_name, value_json, normalized_value, source_type, source_url, confidence, is_selected
product_variants        — id, product_draft_id, variant_key, sku, gtin, option_values, prices, stock_text
product_images          — id, product_draft_id, variant_id?, source_url, source_hash, original_key, webp_key, dimensions, sort_order, rights_confirmed, status
validation_issues       — id, product_draft_id, code, field_name, severity, message, details, resolved
review_decisions        — id, product_draft_id, user_id, action, field_name, old_value, new_value, note
exports                 — id, batch_id, format, storage_key, product_count, created_by
audit_events            — id, org_id, actor_user_id, event_type, entity_type, entity_id, payload
```

## Drizzle konvence

```typescript
// Každá tabulka jako pgTable
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // ...
})

// Schema export pro migrace
export const schema = { users, organizations, /* ... */ }
```

## Migrace

```
packages/database/migrations/
  0001_initial.sql       — users, organizations, organization_members
  0002_projects.sql      — projects, categories
  0003_batches.sql       — import_batches, source_items
  0004_products.sql      — product_drafts, product_facts, product_variants
  0005_images.sql        — product_images
  0006_review.sql        — validation_issues, review_decisions, exports, audit_events
```

Migrace jsou plain SQL soubory (ne Drizzle push), generované přes `drizzle-kit generate`.

## Key queries (helpers)

- `getProductDraftWithFacts(id)` — JOIN product_facts, validation_issues
- `getBatchProgress(batchId)` — COUNT by status
- `getExportableProducts(batchId)` — WHERE status = APPROVED AND no unresolved BLOCKER issues
- `auditLog(event)` — insert do audit_events

## Indexy (plánované)

- `source_items(batch_id, fetch_status)`
- `product_drafts(source_item_id)` — unique
- `product_facts(product_draft_id, field_name)`
- `validation_issues(product_draft_id, severity, resolved)`
- `audit_events(organization_id, created_at)`
