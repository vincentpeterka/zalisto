-- Zalisto — Initial Schema
-- Migration: 0001_initial_schema
-- Created: 2026-06-10
-- Tables: users, organizations, organization_members, projects, categories,
--         import_batches, source_items, product_drafts, product_facts,
--         product_variants, product_images, validation_issues,
--         review_decisions, exports, audit_events

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ORGANIZATIONS & MEMBERS
-- ============================================================

CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'REVIEWER')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- ============================================================
-- PROJECTS & CATEGORIES
-- ============================================================

CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  target_language     TEXT NOT NULL DEFAULT 'cs',
  target_currency     TEXT NOT NULL DEFAULT 'CZK',
  vat_rate            NUMERIC(5,2),
  -- {"sourcePriceIncludesVat": null, "exchangeRate": 1, "marginMode": "MULTIPLIER",
  --  "marginValue": 1.5, "targetVatRate": 21, "rounding": "TO_9"}
  pricing_config      JSONB NOT NULL DEFAULT '{}',
  -- {"tone": "neutral", "forbiddenClaims": [], "language": "cs"}
  text_style_config   JSONB NOT NULL DEFAULT '{}',
  -- {"maxLongEdge": 1600, "webpQuality": 80, "minWidth": 400, "minHeight": 400}
  image_config        JSONB NOT NULL DEFAULT '{}',
  -- Minimum AI confidence for auto-approval (0.0–1.0)
  category_confidence_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.800,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  external_id TEXT,
  name        TEXT NOT NULL,
  full_path   TEXT NOT NULL,
  parent_id   UUID REFERENCES categories(id),
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- IMPORT BATCHES & SOURCE ITEMS
-- ============================================================

CREATE TABLE import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES users(id),
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  total_items     INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE source_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  source_url           TEXT NOT NULL,
  source_sku           TEXT,
  source_gtin          TEXT,
  source_price         NUMERIC(14,4),
  -- Additional fields from CSV upload (supplier ref, notes, etc.)
  input_payload        JSONB NOT NULL DEFAULT '{}',
  fetch_status         TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (fetch_status IN ('PENDING','FETCHING','DONE','FAILED')),
  http_status          INTEGER,
  content_hash         TEXT,
  -- S3 key to raw HTML snapshot
  raw_html_storage_key TEXT,
  fetched_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PRODUCT DRAFTS (one per source_item)
-- ============================================================

CREATE TABLE product_drafts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id          UUID NOT NULL UNIQUE REFERENCES source_items(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN (
                            'PENDING','FETCHING','EXTRACTING','IDENTIFYING','ENRICHING',
                            'GENERATING_CONTENT','PROCESSING_IMAGES','VALIDATING',
                            'READY_FOR_REVIEW','NEEDS_REVIEW','BLOCKED',
                            'APPROVED','EXPORTED','FAILED'
                          )),
  brand                   TEXT,
  model_name              TEXT,
  manufacturer_part_number TEXT,
  gtin                    TEXT,
  product_type            TEXT,
  title_cs                TEXT,
  short_description_cs    TEXT,
  long_description_cs     TEXT,
  bullet_points_cs        JSONB,          -- string[]
  ai_used_fact_ids        JSONB,          -- UUID[] — auditovatelnost AI
  source_price            NUMERIC(14,4),
  target_price            NUMERIC(14,2),
  currency                TEXT,
  -- Full breakdown for audit: {sourcePrice, exchangeRate, priceExclVat, ...}
  pricing_breakdown       JSONB,
  category_id             UUID REFERENCES categories(id),
  category_confidence     NUMERIC(5,4),
  overall_confidence      NUMERIC(5,4),
  review_required         BOOLEAN NOT NULL DEFAULT true,
  approved_at             TIMESTAMPTZ,
  approved_by             UUID REFERENCES users(id),
  failed_reason           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PRODUCT FACTS (provenance per field)
-- ============================================================

CREATE TABLE product_facts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_draft_id UUID NOT NULL REFERENCES product_drafts(id) ON DELETE CASCADE,
  field_name       TEXT NOT NULL,
  value_json       JSONB NOT NULL,
  normalized_value TEXT,
  source_type      TEXT NOT NULL
                   CHECK (source_type IN (
                     'MANUFACTURER','AUTHORIZED_DISTRIBUTOR','SUPPLIER','GS1',
                     'LICENSED_DATABASE','SOURCE_PAGE','RETAILER','AI_INFERENCE','USER_INPUT'
                   )),
  source_url       TEXT,
  confidence       NUMERIC(5,4),
  is_selected      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

CREATE TABLE product_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_draft_id UUID NOT NULL REFERENCES product_drafts(id) ON DELETE CASCADE,
  -- Unique key within product: e.g. "black-xl" derived from option_values
  variant_key      TEXT NOT NULL,
  sku              TEXT,
  gtin             TEXT,
  -- {"color": "Black", "size": "XL"}
  option_values    JSONB NOT NULL DEFAULT '{}',
  source_price     NUMERIC(14,4),
  target_price     NUMERIC(14,2),
  stock_text       TEXT,
  active           BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (product_draft_id, variant_key)
);

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

CREATE TABLE product_images (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_draft_id     UUID NOT NULL REFERENCES product_drafts(id) ON DELETE CASCADE,
  -- NULL = applies to all variants
  variant_id           UUID REFERENCES product_variants(id),
  source_url           TEXT NOT NULL,
  source_hash          TEXT,
  -- S3 key for original downloaded file
  original_storage_key TEXT,
  -- S3 key for processed WebP
  webp_storage_key     TEXT,
  width                INTEGER,
  height               INTEGER,
  size_bytes           INTEGER,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  rights_confirmed     BOOLEAN NOT NULL DEFAULT false,
  status               TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','PROCESSED','TOO_SMALL','FAILED')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- VALIDATION ISSUES
-- ============================================================

CREATE TABLE validation_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_draft_id UUID NOT NULL REFERENCES product_drafts(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  field_name       TEXT,
  severity         TEXT NOT NULL
                   CHECK (severity IN ('INFO','WARNING','ERROR','BLOCKER')),
  message          TEXT NOT NULL,
  details          JSONB NOT NULL DEFAULT '{}',
  resolved         BOOLEAN NOT NULL DEFAULT false,
  resolved_by      UUID REFERENCES users(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- REVIEW DECISIONS (audit trail for manual changes)
-- ============================================================

CREATE TABLE review_decisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_draft_id UUID NOT NULL REFERENCES product_drafts(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id),
  -- 'APPROVE', 'REJECT', 'EDIT_FIELD', 'RESOLVE_ISSUE', 'CHANGE_CATEGORY', etc.
  action           TEXT NOT NULL,
  field_name       TEXT,
  old_value        JSONB,
  new_value        JSONB,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EXPORTS
-- ============================================================

CREATE TABLE exports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  format        TEXT NOT NULL CHECK (format IN ('SHOPTET_XLSX','CSV','ZIP')),
  -- S3 key for the generated ZIP
  storage_key   TEXT NOT NULL,
  product_count INTEGER NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT EVENTS
-- ============================================================

CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES users(id),
  event_type      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Batch progress queries
CREATE INDEX idx_source_items_batch_status    ON source_items (batch_id, fetch_status);
CREATE INDEX idx_product_drafts_source_item   ON product_drafts (source_item_id);
CREATE INDEX idx_product_drafts_status        ON product_drafts (status);

-- Fact lookup
CREATE INDEX idx_product_facts_draft_field    ON product_facts (product_draft_id, field_name);
CREATE INDEX idx_product_facts_selected       ON product_facts (product_draft_id) WHERE is_selected = true;

-- Validation queries
CREATE INDEX idx_validation_issues_draft      ON validation_issues (product_draft_id, severity, resolved);
CREATE INDEX idx_validation_issues_unresolved ON validation_issues (product_draft_id) WHERE resolved = false;

-- Image lookup
CREATE INDEX idx_product_images_draft         ON product_images (product_draft_id, sort_order);

-- Audit log
CREATE INDEX idx_audit_events_org_time        ON audit_events (organization_id, created_at DESC);
CREATE INDEX idx_audit_events_entity          ON audit_events (entity_type, entity_id);

-- Category tree
CREATE INDEX idx_categories_project_parent    ON categories (project_id, parent_id);
CREATE INDEX idx_categories_project_path      ON categories (project_id, full_path);

-- GTIN conflict detection (within project via join to source_items → batches → projects)
CREATE INDEX idx_product_drafts_gtin          ON product_drafts (gtin) WHERE gtin IS NOT NULL;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_product_drafts_updated_at
  BEFORE UPDATE ON product_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
