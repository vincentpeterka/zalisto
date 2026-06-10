# Zalisto — AI Product Importer

Webová aplikace pro dávkový import produktů z dodavatelských URL do Shoptet. Přijme URL, scrapuje produkt, extrahuje fakta, generuje českou produktovou kartu přes OpenAI, zpracuje obrázky do WebP a exportuje Shoptet-ready XLSX + ZIP.

**Stack:** TypeScript monorepo (pnpm + Turborepo) · Next.js · Fastify · PostgreSQL + Drizzle · BullMQ + Redis · Crawlee + Playwright · Sharp · S3/MinIO · OpenAI Structured Outputs · Zod

**Fáze:** MVP — výstup je soubor pro ruční import, žádný přímý zápis do Shoptetu.

## Lokální spuštění

```bash
docker compose up          # postgres, redis, minio
pnpm install
pnpm db:migrate
pnpm dev                   # web + api + worker souběžně
```

Env vars v `.env.local` podle `.env.example` (nikdy necommitovat secrets).

## Struktura repozitáře

```
apps/
  web/       Next.js review UI
  api/       Fastify REST API
  worker/    BullMQ orchestrace
  crawler/   izolovaný fetch + Playwright
packages/
  domain/    typy, statusy, doménová pravidla
  database/  Drizzle schéma + migrace
  extraction/ JSON-LD, HTML, varianty, adaptéry
  identity/  EAN, MPN, deduplikace
  ai/        prompty, structured outputs, model gateway
  validation/ pravidla a confidence
  images/    download, hash, Sharp pipeline
  pricing/   deterministický výpočet cen
  categorization/ strom kategorií, AI návrhy
  export/    Shoptet XLSX + ZIP
  storage/   S3 interface
  observability/ logy, Sentry, metriky
infra/
  docker-compose.yml
  Dockerfile.*
docs/
  ai/        projektová paměť (current_state, architecture, …)
  instructions/  implementační plány
  parts/     reference scripty/kód pro klíčové pilíře
```

## Klíčové principy

- Každý produkt je samostatná BullMQ úloha — selhání neisoluje dávku
- Každé pole má `source_type` + `source_url` v `product_facts`
- AI nikdy není jediným zdrojem kritického údaje (EAN, cena, DPH)
- Cena se počítá pouze deterministickým kódem (`packages/pricing`)
- Playwright je fallback, ne default; běží v izolovaném kontejneru
- Všechny ruční změny se ukládají do `review_decisions`

## Memory & docs/ai workflow

> Viz workspace `vibe/CLAUDE.md` — memory workflow platí pro celý vibe workspace.

Před netriviálním úkolem přečíst:
- `docs/ai/current_state.md` — co je implementováno
- `docs/ai/architecture.md` — doménový model a package závislosti
- `docs/ai/known_errors.md` — grepping před debugováním

Po dokončení updateovat relevantní soubor v `docs/ai/`.

### Automatické memory updates

**Po každé velké změně** (nová feature, etapa, DB migrace, architektonické rozhodnutí) okamžitě:
1. Updatovat `docs/ai/current_state.md` — co přibylo
2. Updatovat `memory/project_zalisto.md` v `C:/Users/peter/.claude/projects/C--Users-peter-OneDrive-Plocha-vibe/memory/`
3. Pokud přibylo architektonické rozhodnutí → `docs/ai/decisions.md`
4. Pokud přibylo nové schéma/service → `docs/ai/architecture.md`

**Když Peter řekne "updatuj memory":**
- Updatovat VŠECHNY relevantní soubory v `docs/ai/` (current_state, architecture, decisions, known_errors dle kontextu)
- Updatovat `memory/project_zalisto.md`
- Nestačí jen memory soubor — `docs/` jde vždy s ním.
