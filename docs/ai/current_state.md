# Current State — Zalisto

**Aktualizováno:** 2026-06-10  
**Fáze:** Etapa 1 kompletní — Fastify API funkční, Docker image builduje

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

### Stubs
- `apps/web`, `apps/worker`, `apps/crawler`
- Packages: extraction, identity, ai, validation, images, pricing, categorization, export, storage, observability

## Známé gotchy

- **Fastify 4, ne 5** — Fastify 5 vyžaduje Node 20; lokální prostředí má Node 18
- **bcryptjs, ne bcrypt** — bcrypt potřebuje node-gyp + Python build; bcryptjs je pure JS
- **`*.tsbuildinfo` v .dockerignore** — bez toho `tsc` s `composite: true` tiše nic nevyprodukuje (čte stale incremental cache)
- **dotenv path** — `../../../../.env` relativně od `src/lib/env.ts` (monorepo root)

## Další krok — Etapa 2

1. `POST /batches` — batch pod projektem (tabulka `import_batches`)
2. `POST /batches/:id/items` — příjem URL nebo CSV/XLSX
3. BullMQ setup + Redis connection (`packages/` nebo `apps/worker`)
4. `fetch-source` worker: fetch raw HTML → hash → S3
5. Progress SSE nebo polling `/batches/:id/status`
