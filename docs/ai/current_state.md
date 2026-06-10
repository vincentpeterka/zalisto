# Current State — Zalisto

**Aktualizováno:** 2026-06-10  
**Fáze:** Etapa 3 kompletní — extraction pipeline funkční, extract-product worker připojen

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

## Další krok — Etapa 4

1. `identify-product` worker — EAN validace checksum, MPN normalizace, deduplikace
2. `packages/identity` — validační logika pro GTIN (Luhn/checksum), MPN cleanup
3. `generate-content` worker — OpenAI Structured Outputs česká produktová karta
4. Playwright fallback (`browser-extract`) worker — izolovaný kontejner
5. Vendor adaptér pro 1-2 pilotní weby
