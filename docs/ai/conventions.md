# Conventions — Zalisto

## Jazyk

- Kód a komentáře: **anglicky**
- UI texty (user-facing): **česky**
- Komunikace s Claudem: česky

## Naming

- Databázové tabulky: `snake_case` (PostgreSQL konvence)
- TypeScript typy/interfaces: `PascalCase`
- Funkce, proměnné: `camelCase`
- Konstanty a enums: `SCREAMING_SNAKE_CASE`
- BullMQ queue names: `kebab-case` (např. `fetch-source`, `process-images`)
- S3 storage keys: `{batchId}/{productId}/{filename}.webp`

## Package struktura

Každý `packages/*` balíček:
- `src/index.ts` — public API (pouze exports co mají být vidět venku)
- `src/types.ts` — doménové typy specifické pro balíček
- Interní moduly nejsou re-exportovány přes index

## API konvence

- REST, JSON
- Auth: session cookie (httpOnly, SameSite=Strict)
- Error response: `{ error: string, code: string, details?: unknown }`
- Pagination: `{ data: T[], total: number, page: number, pageSize: number }`
- IDs: UUID v4

## Databáze

- Každá tabulka má `id UUID PRIMARY KEY`
- Časové sloupce: `TIMESTAMPTZ NOT NULL DEFAULT now()`
- `organization_id` na každé entity (row-level isolation)
- Drizzle migrace jsou checked-in SQL soubory, ne auto-generated

## Worker konvence

- Každá BullMQ úloha přijme `{ sourceItemId: string }` nebo `{ productDraftId: string }`
- Selhání úlohy: uloží error do entity, nastaví status FAILED, **neshazuje celou dávku**
- Retry: max 3x s exponential backoff
- Každý worker loguje: start, konec, duration, výsledek

## Validační pravidla

Severity hierarchie:
- `BLOCKER` — export je zakázán bez výslovného override
- `ERROR` — produkt je NEEDS_REVIEW
- `WARNING` — produkt je READY_FOR_REVIEW, ale upozornění viditelné
- `INFO` — informativní poznámka

Kódy validačních issues jsou `SCREAMING_SNAKE_CASE` popisující problém, ne technický detail.

## AI volání

- Vždy Structured Outputs s Zod schématem
- Systémová instrukce musí obsahovat anti-injection instrukci pro produktové texty
- `usedFactIds` jsou povinnou součástí výstupu pro auditovatelnost
- Nikdy neposlat raw HTML nebo neznámé user-input přímo do promptu

## Obrázky

- Max delší strana: 1600 px (bez upscalingu)
- WebP kvalita: 80
- Naming: `{brand}-{model}-{index:02d}.webp` (lowercase, mezery → pomlčky)
- Originál vždy uložit před transformací

## Testování

- Unit testy pro: EAN checksum, cenové výpočty, DPH, zaokrouhlení, normalizace
- Fixture testy pro každý vendor adaptér (uložené HTML vzorky)
- Integrační testy: API + real PostgreSQL (ne mocky)
- E2E scénář: projekt → dávka → URL → zpracování → review → export

## Soubory

- `.env.example` pro každou app/service (bez skutečných hodnot)
- Secrets nikdy do repozitáře
- Docker Compose pro lokální vývoj, ne pro produkci
