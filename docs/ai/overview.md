# Overview — Zalisto AI Product Importer

## Co projekt dělá

Webová SaaS aplikace pro e-shopy (primárně Shoptet). Přijme seznam URL dodavatelských produktů, automaticky:
1. Scrapuje stránky (HTTP + Playwright fallback)
2. Extrahuje produktová fakta (JSON-LD, HTML, varianty)
3. Identifikuje produkt (EAN/GTIN validace, deduplikace)
4. Generuje české produktové texty přes OpenAI
5. Zpracovává obrázky do WebP
6. Vypočítá prodejní ceny (deterministicky)
7. Navrhne kategorii
8. Prezentuje návrh ke kontrole v review UI
9. Exportuje schválené produkty jako Shoptet XLSX + ZIP obrázků

MVP: žádný přímý zápis do Shoptetu.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js 14 + React + TypeScript
- **API:** Fastify + TypeScript
- **DB:** PostgreSQL 17 + Drizzle ORM
- **Fronta:** BullMQ + Redis 7
- **Scraping:** Crawlee + Cheerio + Playwright
- **AI:** OpenAI Responses API (Structured Outputs)
- **Validace:** Zod + JSON Schema
- **Obrázky:** Sharp
- **Storage:** S3 kompatibilní (MinIO lokálně, Cloudflare R2 prod)
- **Monitoring:** Sentry + strukturované logy

## Struktura adresářů

```
zalisto/
├── apps/
│   ├── web/          Next.js review UI (přihlášení, projekty, dávky, kontrola, export)
│   ├── api/          Fastify REST API (auth, CRUD, stavy, export endpointy)
│   ├── worker/       BullMQ orchestrace a validační úlohy
│   └── crawler/      Izolovaný fetch worker (Crawlee, Cheerio, Playwright)
├── packages/
│   ├── domain/       Typy, enums (ProductStatus, Severity, SourceTrust), doménová pravidla
│   ├── database/     Drizzle schéma (16 tabulek), migrace, query helpers
│   ├── extraction/   JSON-LD, Open Graph, HTML heuristiky, vendor adaptéry
│   ├── identity/     EAN/GTIN checksum, MPN normalizace, deduplikace
│   ├── ai/           OpenAI gateway, prompty, structured output schémata
│   ├── validation/   Pravidla BLOCKER/ERROR/WARNING/INFO, confidence výpočet
│   ├── images/       Download, MIME check, Sharp WebP pipeline, S3 upload
│   ├── pricing/      Deterministický výpočet (kurz, marže, DPH, zaokrouhlení)
│   ├── categorization/ Strom kategorií, AI návrhy, confidence threshold
│   ├── export/       Shoptet XLSX mapování, CSV, ZIP generátor
│   ├── storage/      S3 interface (MinIO/R2/B2)
│   └── observability/ Sentry, logy, BullMQ metriky
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile.*
└── docs/
    ├── ai/           Projektová paměť
    ├── instructions/ Implementační plány
    └── parts/        Reference kód pro klíčové pilíře
```

## Scope MVP

- Zpracování produktů z URL (dávkově, ≥50 URL/dávka)
- Podpora 2–3 pilotních dodavatelských webů
- Výstup: XLSX + ZIP pro manuální import do Shoptetu
- Multi-tenant (organizace → projekty → dávky)
- Role: OWNER, ADMIN, REVIEWER

## Mimo scope MVP

- Přímé Shoptet API / OAuth
- Více než 3 platformy
- Mobilní aplikace
- Automatické schvalování bez review
- GS1 / Icecat konektory
- SaaS fakturace
