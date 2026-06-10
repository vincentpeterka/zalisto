# TODO — Zalisto AI Product Importer

Pořadí odpovídá implementačním etapám z `v1.1_plan.md`.

---

## ETAPA 0 — Technický spike (CLI prototyp)
> **Cíl:** ověřit pipeline na 10 reálných URL. Go/No-Go brána před buildováním UI.

- [ ] Vybrat 2 pilotní dodavatelské weby
- [ ] Napsat `packages/extraction` spike: HTTP fetch + JSON-LD parser
- [ ] Napsat `packages/identity` spike: EAN checksum validace
- [ ] Napsat `packages/images` spike: download + Sharp WebP pipeline
- [ ] Připravit OpenAI Structured Outputs schéma pro produktovou kartu
- [ ] Napsat `packages/ai` spike: česká karta z faktů
- [ ] CLI entry point: `pnpm import-product --url X --categories Y --output Z`
- [ ] Exportovat výsledek do `product.json`, `product.csv`, `validation.json`, `images/`
- [ ] Změřit: % URL s úspěšnou extrakcí, čas/produkt, AI náklady/produkt
- [ ] **GO/NO-GO rozhodnutí** (<30% manuálních zásahů = GO)

---

## ETAPA 1 — Monorepo základ + infrastruktura

- [ ] Inicializovat pnpm workspaces + Turborepo
- [ ] Docker Compose: postgres:17, redis:7, minio, api, web, worker, crawler
- [ ] `packages/domain`: TypeScript typy, ProductStatus enum, Severity enum, SourceTrust enum
- [ ] `packages/database`: Drizzle schéma (16 tabulek z v1.1_plan), první migrace
- [ ] `apps/api`: Fastify bootstrap, health endpoint, základní middleware
- [ ] Auth: registrace, přihlášení (session cookie, httpOnly)
- [ ] Organizations + users CRUD
- [ ] Projects CRUD s `pricing_config` a `text_style_config`
- [ ] `audit_events` tabulka + helper pro logování
- [ ] `.env.example` soubory pro každou app
- [ ] **Acceptance:** `docker compose up` → uživatel se přihlásí, vytvoří projekt

---

## ETAPA 2 — URL ingestion + fronta

- [ ] `POST /batches` + `POST /batches/:id/items` API
- [ ] CSV/XLSX upload parser pro URL seznam
- [ ] SSRF ochrana (DNS + privátní IP blacklist + redirect kontrola)
- [ ] `source_items` tabulka + Drizzle queries
- [ ] BullMQ setup + `fetch-source` worker
- [ ] HTTP fetch s timeout, size limit, MIME whitelist
- [ ] Uložení raw HTML do S3 (MinIO)
- [ ] Content hash pro dedup
- [ ] Progress SSE endpoint nebo polling `/batches/:id/status`
- [ ] **Acceptance:** 100 URL v jedné dávce, 1 selhání neblokuje ostatní

---

## ETAPA 3 — Extrakce faktů

- [ ] `packages/extraction`: JSON-LD `script[type=application/ld+json]` parser
- [ ] Open Graph + meta tag extrakce
- [ ] HTML heuristiky (cena, SKU, breadcrumbs, tabulky parametrů)
- [ ] `product_facts` tabulka insert helpers
- [ ] `extract-product` BullMQ worker
- [ ] Playwright fallback worker (`browser-extract`) v izolovaném kontejneru
- [ ] Vendor adaptér #1 (pilotní web)
- [ ] Vendor adaptér #2 (pilotní web)
- [ ] **Acceptance:** základní fakta extrahována, každý údaj má source_type + source_url

---

## ETAPA 4 — Identita produktu + varianty

- [ ] `packages/identity`: EAN-8, EAN-13, GTIN-14 checksum validace
- [ ] MPN normalizace (strip special chars, lowercase)
- [ ] Brand normalizace
- [ ] Variantní model: `product_variants` tabulka, unikátní `variant_key`
- [ ] Deduplikace v rámci projektu (match by GTIN nebo brand+MPN)
- [ ] `identify-product` BullMQ worker
- [ ] `validation_issues` insert pro: GTIN_INVALID_CHECKSUM, GTIN_CONFLICT, VARIANT_DUPLICATE_GTIN
- [ ] **Acceptance:** neplatný EAN → BLOCKED, konflikt EAN → NEEDS_REVIEW

---

## ETAPA 5 — AI obsah + kategorizace

- [ ] `packages/ai`: OpenAI client wrapper, retry logic, cost tracking
- [ ] Definovat Zod schéma pro `generate-content` Structured Output
- [ ] Systémová instrukce s anti-prompt-injection pravidly
- [ ] `generate-content` BullMQ worker
- [ ] Uložit `usedFactIds` do ProductDraft
- [ ] `packages/categorization`: import stromu kategorií (CSV)
- [ ] AI kategorizace s confidence score
- [ ] `categorize-product` BullMQ worker
- [ ] Confidence threshold (výchozí 0.80) → NEEDS_REVIEW pod prahem
- [ ] **Acceptance:** každý technický údaj má usedFactId, kategorie pod prahem → review

---

## ETAPA 6 — Ceny + obrázky

- [ ] `packages/pricing`: deterministický výpočet (exchange × markup + VAT + rounding)
- [ ] Ukládat každý mezivýsledek ceny
- [ ] BLOCKER ValidationIssue pokud DPH nejasné
- [ ] `calculate-price` BullMQ worker
- [ ] `packages/images`: download s MIME kontrolou
- [ ] Sharp pipeline: orientace, resize (max 1600px), WebP q=80
- [ ] SHA-256 hash pro dedup
- [ ] S3 upload (original + webp)
- [ ] Variantní přiřazení obrázků
- [ ] `process-images` BullMQ worker
- [ ] **Acceptance:** cena bez DPH info = BLOCKER; obrázky WebP, správně resize

---

## ETAPA 7 — Validace + review UI

- [ ] `packages/validation`: finální pravidla (BLOCKER/ERROR/WARNING/INFO kódy)
- [ ] `validate-product` BullMQ worker (finální přechod do READY_FOR_REVIEW nebo BLOCKED)
- [ ] `apps/web`: Next.js setup, layout, auth pages
- [ ] Tabulka produktů (filtry: READY/NEEDS_REVIEW/BLOCKED/no-image/EAN-conflict)
- [ ] Detail produktu: 3-panel (zdroj | návrh | sources + issues)
- [ ] Editace polí (field override → review_decision záznam)
- [ ] Změna kategorie + přepsání ceny
- [ ] Schválení/zamítnutí obrázků
- [ ] Hromadné schválení bezpečných produktů (READY_FOR_REVIEW bez BLOCKER)
- [ ] `POST /products/:id/approve` + `/reject` + `/reprocess`
- [ ] **Acceptance:** reviewer vidí zdroj každé hodnoty, BLOCKER nejde obejít bez akce

---

## ETAPA 8 — Export

- [ ] `packages/export`: Shoptet XLSX sloupce mapping
- [ ] CSV export (alternativní formát)
- [ ] ZIP generátor (XLSX + images/ + reports)
- [ ] `manifest.json` s metadaty dávky
- [ ] `generate-export` BullMQ worker
- [ ] `POST /batches/:id/exports` + `GET /exports/:id/download`
- [ ] Blokované produkty jsou v `validation-report.csv`, ne v hlavním importu
- [ ] **Acceptance:** export projde Shoptet testovacím importem

---

## ETAPA 9 — Pilot + měření

- [ ] Domluvit pilotního zákazníka
- [ ] Zpracovat 50–100 reálných produktů
- [ ] Vytvořit zlatý dataset (50 produktů, ručně ověřené hodnoty)
- [ ] Regresní testy nad zlatým datasetem
- [ ] Měřit: čas/produkt, AI náklady/produkt, % oprav, % blockerů
- [ ] Porovnat s ruční prací (čas + cena)
- [ ] **GO/REWORK/STOP rozhodnutí**

---

## Průřezové úkoly (kdykoli)

- [ ] Sentry integrace (error tracking)
- [ ] Strukturované logy (pino nebo winston)
- [ ] BullMQ dashboard (bull-board)
- [ ] Unit testy: EAN checksum, cenové výpočty, DPH, zaokrouhlení
- [ ] Fixture testy: HTML vzorky pilotních webů
- [ ] Integrační testy: API + real PostgreSQL
- [ ] E2E test scénář (projekt → dávka → URL → zpracování → export)
- [ ] README: lokální spuštění, env vars, docker compose
