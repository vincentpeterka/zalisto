# Zalisto — AI Product Importer

Batch import produktů z dodavatelských URL do Shoptet. Přijme URL, scrapuje stránku, extrahuje fakta, vygeneruje českou produktovou kartu přes OpenAI, zpracuje obrázky do WebP a exportuje Shoptet-ready XLSX + ZIP.

## Stack

- **API** — Fastify 4, Drizzle ORM, PostgreSQL 17
- **Worker** — BullMQ + Redis (9 workerů v pipeline)
- **Web** — Next.js 13, SWR
- **AI** — OpenAI GPT-4o-mini, Structured Outputs
- **Storage** — S3 / MinIO
- **Monorepo** — pnpm + Turborepo

## Požadavky

- Node.js ≥ 20 (lokálně funguje i 18)
- pnpm ≥ 9
- Docker Desktop

## Lokální spuštění

```bash
# 1. Spusť infrastrukturu (PostgreSQL, Redis, MinIO)
docker compose -f infra/docker-compose.yml up -d

# 2. Vytvoř MinIO bucket (jen poprvé)
docker exec infra-minio-1 sh -c \
  "mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/zalisto --ignore-existing"

# 3. Nainstaluj závislosti
pnpm install

# 4. Zkopíruj env vars
cp .env.example .env
# Uprav .env — minimálně nastav OPENAI_API_KEY

# 5. Spusť migrace
pnpm db:migrate

# 6. Spusť vše souběžně
pnpm dev
```

| Služba | URL |
|--------|-----|
| API | http://localhost:3002 |
| Web UI | http://localhost:3003 |
| BullMQ dashboard | http://localhost:3002/admin/queues |
| Adminer (DB) | http://localhost:8080 |
| MinIO | http://localhost:9001 |

## Env vars

Zkopíruj `.env.example` do `.env` a nastav:

| Proměnná | Popis | Výchozí |
|----------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://...` |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `SESSION_SECRET` | Náhodný tajný klíč (min 32 znaků) | — |
| `OPENAI_API_KEY` | OpenAI API klíč | — |
| `S3_ENDPOINT` | MinIO nebo S3 endpoint | `http://localhost:9000` |
| `S3_BUCKET` | Název bucketu | `zalisto` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `SENTRY_DSN` | Sentry DSN (volitelné) | — |
| `LOG_LEVEL` | Úroveň logů (`info`/`debug`/...) | `info` |

## Spuštění testů

```bash
pnpm test                              # všechny balíčky
pnpm --filter @zalisto/api test        # API integrační testy
pnpm --filter @zalisto/worker test     # worker unit testy
pnpm --filter @zalisto/extraction test
pnpm --filter @zalisto/identity test
pnpm --filter @zalisto/pricing test
```

## Pipeline

```
URL podána přes API
  ↓
fetch-source       — stáhne HTML, uloží do S3
  ↓
extract-product    — JSON-LD / OG / HTML heuristiky
  ↓
identify-product   — GTIN checksum, deduplikace
  ↓
generate-content   — AI titulek + popis (GPT-4o-mini)
  ↓
categorize-product — AI kategorizace
  ↓
calculate-price    — deterministický výpočet (kurz, DPH, marže)
  ↓
process-images     — download, Sharp → WebP, S3 upload
  ↓
validate-product   — BLOCKER / ERROR / WARNING pravidla
  ↓
READY_FOR_REVIEW / NEEDS_REVIEW / BLOCKED
  ↓
Review UI → approve / reject / reprocess
  ↓
generate-export    — Shoptet XLSX + ZIP ke stažení
```

## Struktura monorepa

```
apps/
  api/       Fastify REST API (port 3001)
  web/       Next.js review UI (port 3000)
  worker/    BullMQ worker orchestrace
packages/
  domain/    Sdílené typy a enumy
  database/  Drizzle schéma + migrace + helpers
  extraction/ JSON-LD, OG meta, HTML heuristiky
  identity/  GTIN checksum, MPN normalizace
  ai/        OpenAI gateway, content + categorization prompts
  validation/ Pravidla kvality (BLOCKER/ERROR/WARNING/INFO)
  images/    Download, Sharp pipeline
  pricing/   Deterministický výpočet ceny
  categorization/ Strom kategorií pro AI
  export/    Shoptet XLSX + ZIP builder
  storage/   S3 / MinIO klient
infra/
  docker-compose.yml
  Dockerfile.api
```
