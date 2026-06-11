# Current State — Zalisto

**Aktualizováno:** 2026-06-10  
**Fáze:** Etapa 5 kompletní — AI obsah + kategorizace funkční

## Co existuje a funguje

### Monorepo scaffold
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- `.gitignore`, `.env.example` (obsahuje SESSION_SECRET, PORT, CORS_ORIGIN), `.env` (lokální)
- `.dockerignore` — blokuje node_modules, dist, .turbo, `*.tsbuildinfo`, .env

### `packages/domain` — HOTOVO, builduje se
- Enums: `ProductStatus`, `IssueSeverity`, `SourceTrust`, `ValidationIssueCode`, `OrgRole`, `ExportFormat`
- Types: `ProductFact`, `ProductVariant`, `ProductDraft`, `GeneratedContent`, `ProcessedImage`, `PricingConfig`, `CategoryMatch`

### `apps/cli` — Etapa 0 HOTOVO, TypeScript bez chyb
- fetcher, extractor, ean-validator, ai-content, image-processor, categorizer, reporter, pipeline

### `packages/database` — schéma hotovo, migrace aplikována
- Drizzle schéma: 5 souborů, 15 tabulek + 13 indexů + updated_at trigger
- `migrations/0001_initial_schema.sql` — aplikováno na lokální DB

### `apps/api` — **Etapa 1 KOMPLETNÍ**

Stack: Fastify 4, @fastify/session (httpOnly cookie 7 dní), bcryptjs, drizzle-orm, zod, fastify-plugin

**Soubory:**
- `src/lib/env.ts` — validace env vars, dotenv z `../../../../.env`
- `src/lib/audit.ts` — insert do `audit_events`
- `src/plugins/auth.ts` — register/login/logout/me, bcrypt rounds=12
- `src/plugins/organizations.ts` — CRUD + members, row-level access
- `src/plugins/projects.ts` — CRUD pod org, OWNER/ADMIN role check
- `src/index.ts` — Fastify bootstrap + CORS + cookie + session

**Endpointy (18 celkem):**
```
GET  /health
POST /auth/register|login|logout
GET  /auth/me
GET|POST /organizations
GET|PATCH|DELETE /organizations/:orgId
GET  /organizations/:orgId/members
GET|POST /organizations/:orgId/projects
GET|PATCH|DELETE /projects/:projectId
```

**Testy (2026-06-10):** 20/21 PASS — 1 FAIL byl race condition v test skriptu (server log vmíšen do stdout), ne bug v kódu.

### Infrastruktura — BĚŽÍ + Docker image
- Docker: PostgreSQL 17 (5432), Adminer (8080), Redis (6379), MinIO (9000/9001)
- `infra/Dockerfile.api` — multi-stage build, node:20-alpine, builduje a startuje
- `infra/docker-compose.yml` — `api` service aktivní (port 3001)

### Testy — HOTOVO

**Worker unit testy** (`apps/worker/src/lib/fetcher.test.ts`):
- 17/17 PASS — `isPrivateIp` (10 případů), `isAllowedScheme` (7 případů)

**API integration testy** (`apps/api/src/test/batches.test.ts`):
- 21/21 PASS — POST /batches (5), GET /batches (2), POST items (9), GET status (5)
- `apps/api/src/test/helpers.ts` — `buildApp()`, `registerAndLogin()`, `createOrg()`, `createProject()`
- `apps/api/src/app.ts` — factory bez `listen`, sdílena indexem i testy
- Spuštění: `pnpm --filter @zalisto/api test` | `pnpm --filter @zalisto/worker test`

### `packages/storage` — S3 klient, HOTOVO
- `createStorageClient()` — AWS SDK v3, `put()`, `getSignedDownloadUrl()`
- ForcePathStyle pro MinIO kompatibilitu

### `apps/api` — **Etapa 2 KOMPLETNÍ**
Nový plugin `src/plugins/batches.ts`:
```
POST /projects/:projectId/batches         → vytvoří batch
GET  /projects/:projectId/batches         → seznam batchů
GET  /batches/:batchId                    → detail batche
POST /batches/:batchId/items              → příjem URL, enqueue do BullMQ
GET  /batches/:batchId/status             → polling stav (items breakdown by fetchStatus)
```
- URL validace: scheme whitelist (http/https), individuální per-URL (invalid vrací `invalidUrls`)
- Max 500 URL na request
- BullMQ `fetch-source` fronta s Redis

### `apps/worker` — `fetch-source` worker, HOTOVO
- `src/env.ts` — dotenv z `../../../.env` (3 úrovně, ne 4 jako API)
- `src/lib/fetcher.ts` — SSRF ochrana (DNS + private IP), redirect follow, 5 MB limit, 30s timeout
- `src/workers/fetch-source.ts` — concurrency=5, 3 pokusy, exponential backoff
  - fetch → S3 upload (`raw-html/{batchId}/{itemId}.html`) → DB update (hash, storageKey, fetchedAt)
  - selhání jednoho itemu neblokuje ostatní

### Stubs
- `apps/web`, `apps/crawler`
- Packages: extraction, identity, ai, validation, images, pricing, categorization, export, observability

### Testy — Etapa 3 (2026-06-10)

- **`packages/extraction`** — 28/28 PASS
  - `json-ld.test.ts` — 9 testů (name/brand/gtin/price/images/variants/@graph/malformed/non-Product)
  - `html-heuristics.test.ts` — 13 testů (h1/price EU+US/gtin/brand/sku/image/breadcrumbs/specs/empty)
  - `extraction.test.ts` — 6 testů (full JSON-LD, override merge, low-confidence fallback, OG-only, dedup, empty)
- **`apps/worker` unit testy** — 17/17 PASS (beze změny)

## Známé gotchy

- **Fastify 4, ne 5** — Fastify 5 vyžaduje Node 20; lokální prostředí má Node 18
- **bcryptjs, ne bcrypt** — bcrypt potřebuje node-gyp + Python build; bcryptjs je pure JS
- **`*.tsbuildinfo` v .dockerignore** — bez toho `tsc` s `composite: true` tiše nic nevyprodukuje (čte stale incremental cache)
- **dotenv path v api** — `../../../../.env` relativně od `src/lib/env.ts` (apps/api/src/lib → zalisto root)
- **dotenv path v worker** — `../../../.env` (apps/worker/src → zalisto root; o úroveň výš než api)
- **ioredis import** — `import { Redis } from 'ioredis'` (named export), ne default import; default způsobuje TS2351
- **MinIO bucket** — nutno vytvořit před startem workeru: `docker exec infra-minio-1 sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/zalisto"`

### `packages/extraction` — **Etapa 3 KOMPLETNÍ**

Stack: cheerio, @zalisto/domain

**Soubory:**
- `src/types.ts` — `ExtractionResult` interface
- `src/json-ld.ts` — JSON-LD `@type: Product` parser (name, brand, gtin, price, images, variants)
- `src/open-graph.ts` — OG meta tags + `product:*` meta tags
- `src/html-heuristics.ts` — cheerio selektory (h1, itemprop, .price, breadcrumbs, specs tabulky)
- `src/index.ts` — `extractProduct(html, sourceUrl): ExtractionResult`, merge strategies (highest confidence wins)

**Confidence model:**
- JSON-LD: 0.9, OG: 0.7, HTML heuristiky: 0.5–0.75
- `needsBrowserFallback: true` pokud confidence < 0.4

### `packages/database` — helpers rozšířeny

- `src/helpers/product-facts.ts` — `insertProductDraftWithFacts()` (insertuje draft + fakta + obrázky v jedné transakci)
- Exportováno z `src/index.ts`

### `packages/storage` — rozšíření

- Přidána metoda `get(key): Promise<Buffer>` — streaming download z S3/MinIO

### `apps/worker` — `extract-product` worker

- `src/workers/extract-product.ts` — concurrency=5
  - čte raw HTML z S3 (storage.get)
  - volá `extractProduct()` z `@zalisto/extraction`
  - vytvoří `product_draft` + inserts fakta + obrázky
  - pokud `needsBrowserFallback` → enqueue `browser-extract`, jinak → enqueue `identify-product`
- `fetch-source` worker → po DONE enqeueue `extract-product`
- registrován v `src/index.ts`

### `packages/identity` — **Etapa 4 KOMPLETNÍ**

- `src/gtin.ts` — `validateGtin(raw)` → `{ valid, normalized, type, error }`; GS1 checksum pro EAN-8/EAN-13/GTIN-14; `toGtin14()` padding
- `src/mpn.ts` — `normalizeMpn()` (strip special chars, lowercase), `normalizeBrand()` (lowercase, collapse whitespace)
- **17/17 testů PASS** (8 gtin + 6 mpn/brand)

### `packages/database` — rozšíření (Etapa 4)

- `src/helpers/identity.ts` — `insertValidationIssue()`, `updateDraftIdentity()`, `findDraftByGtinInProject()`, `findDraftByBrandMpnInProject()`

### `apps/worker` — `identify-product` worker

- `src/workers/identify-product.ts` — concurrency=5
  - čte productDraft + fakta, resolves projectId přes join
  - GTIN checksum → GTIN_INVALID_CHECKSUM (BLOCKER) → status BLOCKED
  - GTIN conflict v projektu → GTIN_CONFLICT (ERROR) → NEEDS_REVIEW
  - brand+MPN duplicate → VARIANT_DUPLICATE_MPN (WARNING), pokračuje
  - normalizuje gtin/brand/mpn na draft, enqueue `generate-content`
- registrován v `src/index.ts`

### Testy — Etapa 4 (2026-06-10)

- **`packages/identity`** — 17/17 PASS (`gtin.test.ts`: 11 testů, `mpn.test.ts`: 6 testů)

### `packages/ai` — **Etapa 5 KOMPLETNÍ**

Stack: openai ^4.77, zod ^3.23

**Soubory:**
- `src/openai-gateway.ts` — OpenAI wrapper, zodResponseFormat, retry 3x (429/5xx + exponential backoff), cost tracking (gpt-4o-mini pricing)
- `src/schemas/content.ts` — `ContentOutputSchema` (titleCs, shortDescriptionCs, longDescriptionCs, bulletPoints, warnings, usedFactIds)
- `src/schemas/categorization.ts` — `CategorizationOutputSchema` (primaryCategoryId, alternativeCategoryIds, confidence, reason)
- `src/content-generator.ts` — `generateContent(facts, textStyleConfig)`, anti-injection systémová instrukce
- `src/categorizer.ts` — `categorizeProduct(product, categories)`, max 200 kategorií v promptu

### `packages/categorization` — **Etapa 5 KOMPLETNÍ**

- `src/format-tree.ts` — `formatCategoryTree(categories, maxItems=200)` — filtruje inactive, truncuje pro token budget

### `packages/database` — rozšíření (Etapa 5)

- `src/helpers/content.ts` — `updateDraftContent()`, `updateDraftCategory()`

### `apps/worker` — Etapa 5 workery

- `src/workers/generate-content.ts` — concurrency=3
  - načítá selected facts (fallback: všechny fakty)
  - volá `generateContent()` z `@zalisto/ai`
  - ukládá title_cs, descriptions, bulletPoints, aiUsedFactIds
  - varování pokud AI referenced unknown fact ID
  - enqueue `categorize-product`
- `src/workers/categorize-product.ts` — concurrency=3
  - načítá kategorie projektu, confidence threshold
  - volá `categorizeProduct()` z `@zalisto/ai`
  - ověřuje, že vrácené ID patří do projektu
  - pokud confidence < threshold → ValidationIssue WARNING + NEEDS_REVIEW
  - jinak → READY_FOR_REVIEW
- Registrovány v `src/index.ts` (5 workerů celkem)

### Testy — Etapa 5 (2026-06-10)

- **`packages/ai`** — 18/18 PASS (`schemas.test.ts`: ContentOutputSchema 10 testů, CategorizationOutputSchema 8 testů)
- **`packages/categorization`** — 8/8 PASS (`format-tree.test.ts`: filtry, truncation, order, edge cases)
- **`apps/worker` unit testy** — 17/17 PASS (beze změny; AI workery volají OpenAI, integration testy v Etapě 9)

### Opravené bugy (Etapa 5 review)

- `generate-content.ts` — nesprávně nastavoval status `PROCESSING_IMAGES` hned po AI; odstraněno (status nastavuje `categorize-product`)
- `categorize-product.ts` — nenačítal pouze aktivní kategorie; přidáno `.filter(c => c.active)`
- `database/helpers/content.ts` — nepoužitý import `validationIssues`; odstraněn
- `packages/categorization/package.json` — BOM znak způsoboval crash tsx; fix: UTF-8 bez BOM

### `packages/pricing` — **Etapa 6 KOMPLETNÍ**

- `src/calculate.ts` — `calculatePrice(sourcePrice, sourceCurrency, config): PriceCalculationResult`
  - exchange rate → strip source VAT (if included) → apply margin (MULTIPLIER/FIXED) → add target VAT → round
  - rounding: TO_9 (psychological pricing), TO_0, UP, DOWN, NONE
  - returns `{ ok: true, breakdown }` nebo `{ ok: false, reason: 'VAT_STATUS_UNKNOWN'|'NO_PRICE'|'INVALID_CONFIG' }`
- **15/15 testů PASS** (`calculate.test.ts`)

### `packages/images` — **Etapa 6 KOMPLETNÍ**

- `src/download.ts` — `downloadImage(url)`: fetch s 30s timeout, MIME allowlist (jpeg/png/webp/gif/avif), max 10 MB
- `src/process.ts` — `processImage(buffer)`: sharp auto-orient → resize max 1600px → WebP q=80 → SHA-256 hash
- **7/7 testů PASS** (`download.test.ts` — MIME validace)

### `packages/database` — rozšíření (Etapa 6)

- `src/helpers/pricing.ts` — `updateDraftPrice()` (targetPrice, pricingBreakdown, status)
- `src/helpers/images.ts` — `updateProductImage()`, `updateDraftStatusAfterImages()`

### `apps/worker` — Etapa 6 workery (7 workerů celkem)

- `src/workers/calculate-price.ts` — concurrency=5
  - čte draft + fakta + projektový `pricingConfig`
  - VAT_STATUS_UNKNOWN → ValidationIssue BLOCKER → BLOCKED
  - NO_PRICE → ValidationIssue WARNING, pokračuje na process-images
  - INVALID_CONFIG → ValidationIssue ERROR, pokračuje
  - úspěch → uloží targetPrice + breakdown, enqueue `process-images`
- `src/workers/process-images.ts` — concurrency=3
  - stáhne každý obrázek z `product_images`, zpracuje přes Sharp
  - original + WebP nahraje do S3 (`images/{draftId}/{imageId}/original`, `.../webp.webp`)
  - TOO_SMALL (< 200px) → ValidationIssue WARNING + NEEDS_REVIEW
  - FAILED image → ValidationIssue WARNING + NEEDS_REVIEW
  - finální status: READY_FOR_REVIEW nebo NEEDS_REVIEW
- `categorize-product` upraven: enqeueue `calculate-price` místo nastavení READY_FOR_REVIEW; mezistatus PROCESSING_IMAGES

## Etapa 7 — KOMPLETNÍ (2026-06-10)

### `packages/validation` — KOMPLETNÍ

- `src/types.ts` — `DraftSnapshot`, `FactSnapshot`, `ImageSnapshot`, `ExistingIssue`, `ValidationResult`
- `src/rules.ts` — `runValidationRules()` — pravidla: MISSING_TITLE (BLOCKER), MISSING_PRICE (ERROR), MISSING_BRAND (WARNING), MISSING_MODEL (WARNING), MISSING_CATEGORY (ERROR), MISSING_DESCRIPTION (WARNING), NO_USABLE_IMAGE (ERROR), RIGHTS_NOT_CONFIRMED (INFO)
- `src/validate.ts` — `validateDraft()` — agreguje stávající + nové problémy → finalStatus BLOCKED / NEEDS_REVIEW / READY_FOR_REVIEW
- **9/9 testů PASS** (`validate.test.ts`)

### `apps/worker` — Etapa 7 worker (8 workerů celkem)

- `src/workers/validate-product.ts` — concurrency=5, enqueueován z `process-images`
  - čte draft + fakta + obrázky + existující issues
  - volá `validateDraft()` z `@zalisto/validation`
  - insertuje nové ValidationIssues
  - finální status: READY_FOR_REVIEW / NEEDS_REVIEW / BLOCKED
- `process-images` upraven: nestaví finální status sám — enqueueuje `validate-product` se stavem VALIDATING

### `apps/api` — products plugin

Nový plugin `src/plugins/products.ts`:
```
GET  /projects/:projectId/products        → seznam s filtrem ?status=
GET  /products/:draftId                   → detail + facts + images + issues + decisions
PATCH /products/:draftId/fields           → field override → review_decision
POST /products/:draftId/approve
POST /products/:draftId/reject            → body: { note? }
POST /products/:draftId/reprocess
POST /projects/:projectId/products/bulk-approve → body: { draftIds[] }
```
- Bulk approve: verifikuje READY_FOR_REVIEW status + žádné unresolved BLOCKER issues
- Approve: blokováno pro produkty ve stavu BLOCKED
- Field override: ukládá do `review_decisions` (action=FIELD_OVERRIDE, old/new value)

### `apps/web` — Next.js review UI — KOMPLETNÍ

Stack: Next.js 13.5 + React 18, SWR, Babel (SWC disabled pro Node 18.16 kompatibilitu)

**Stránky:**
- `/login` — přihlašovací formulář
- `/orgs` — seznam organizací
- `/orgs/[orgId]` — seznam projektů
- `/projects/[projectId]` — tabulka produktů (filtry READY/NEEDS_REVIEW/BLOCKED/APPROVED, bulk approve, statistiky)
- `/products/[draftId]` — 3-panel detail: Zdroj dat | Produkt (editovatelné pole) | Issues + Historie + Metadata

**Funkce review UI:**
- BLOCKER banner — červeně, nelze schválit
- Edit pole → PATCH /fields → review_decision
- Schválit / Zamítnout (s poznámkou) / Znovu zpracovat
- Hromadné schválení READY_FOR_REVIEW produktů bez BLOCKER issues
- Zdroj každé hodnoty viditelný (sourceType + confidence)
- Flash zprávy (ok/err)

**Build poznámka:**
- `.babelrc` s `next/babel` preset — nutné pro Node 18.16 (SWC segfaultuje)
- `next.config.js` — CommonJS (`module.exports`, ne ESM `export default`)

## Etapa 8 — KOMPLETNÍ (2026-06-11)

### `packages/export` — KOMPLETNÍ

- `src/types.ts` — `ApprovedProduct`, `BlockedProduct`, `SourceReportRow`, `ExportManifest`, `ZipImage`
- `src/xlsx-builder.ts` — `buildShoptetXlsx()` — ExcelJS, 22 sloupců (Kód, Název, Krátký popis, Popis, Výrobce, Kód výrobce, EAN, Cena s DPH, Sazba DPH, Kategorie, Aktivní, Obrázek 1–10), `SHOPTET_COLUMNS` konstanta
- `src/csv-builder.ts` — `buildValidationReport()` (blokované produkty), `buildSourceReport()` (mapování URL → produkt)
- `src/zip-builder.ts` — `buildExportZip()` — JSZip, DEFLATE level 6
- `src/manifest.ts` — `buildManifest()` — manifest.json s metadaty
- **9/9 testů PASS** (`xlsx-builder.test.ts`: 7 testů SHOPTET_COLUMNS + buildShoptetXlsx, 2 edge cases)

### DB migrace

- `migrations/0002_export_status.sql` — `storage_key` nullable + `status` TEXT (PENDING/PROCESSING/READY/FAILED)
- `packages/database/src/schema/review.ts` — `exports` tabulka aktualizována
- `packages/database/src/helpers/exports.ts` — `insertExportRecord()`, `updateExportRecord()`, `findExportById()`, `findExportsByBatchId()`

### `apps/worker` — `generate-export` worker (9. worker)

- `src/workers/generate-export.ts` — concurrency=2
  - Načte APPROVED drafty pro batch (JOIN source_items → product_drafts → categories → projects)
  - Načte BLOCKED drafty pro validation-report
  - Stáhne WebP z S3, přegeneruje slug-based filenames
  - `buildShoptetXlsx()` + `buildValidationReport()` + `buildSourceReport()` + `buildExportZip()`
  - Uploaduje ZIP do S3 `exports/{batchId}/{exportId}.zip`
  - Po exportu nastavuje status APPROVED draftů na EXPORTED
  - On failure: aktualizuje export record na FAILED

### `apps/api` — exports plugin

Nový plugin `src/plugins/exports.ts`:
```
POST /batches/:batchId/exports         → vytvoří export record (PENDING) + enqueue generate-export → 202
GET  /batches/:batchId/exports         → seznam exportů pro batch
GET  /exports/:exportId/download       → signed URL (READY), 202 (PROCESSING), 500 (FAILED)
```

## Aktuální stav backendu — 9 workerů, 3 API pluginy

Pipeline: fetch-source → extract-product → identify-product → generate-content → categorize-product → calculate-price → process-images → validate-product

Export: `POST /batches/:id/exports` → generate-export worker (mimo pipeline, on-demand)

## Průřezové úkoly — HOTOVO (2026-06-11)

### Strukturované logy — pino

- API: `logger: { level, transport: pino-pretty }` v dev, JSON v prod; LOG_LEVEL env var
- Worker: `apps/worker/src/lib/logger.ts` — `logger` (root) + `workerLogger(name)` → child logger s `{ worker }` fieldem
- Všechny `console.log/error/warn` ve workerech nahrazeny `log.info/error/warn`

### BullMQ dashboard — bull-board

- `@bull-board/api` + `@bull-board/fastify` nainstalováno
- Dostupné na `http://localhost:3001/admin/queues`
- Všech 9 front zobrazeno (fetch-source → generate-export)

### Sentry

- `@sentry/node` v API i workeru
- Init podmíněný přítomností `SENTRY_DSN` env var
- API: `onError` hook → `Sentry.captureException()`
- Worker: zachytává neočekávané selhání

### README

- `README.md` v kořenu projektu s lokálním spuštěním, env vars, pipeline, strukturou

### Průřezové — stav

- Unit testy (EAN, ceny): ✅ hotovo v Etapě 4 + 6
- Fixture testy (HTML): ✅ hotovo v Etapě 3 (extraction 28/28)
- Integrační testy API: ✅ hotovo v Etapě 2 (batches 21/21)
- E2E test scénář: odkládáme na po pilotu

## Další krok — Etapa 9 (po prvním demu)

Pilotní zákazník, golden dataset 50 produktů, měření čas/náklady.
