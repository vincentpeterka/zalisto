# Decisions — Zalisto

## 2026-06

### TypeScript místo Python+TypeScript kombinace
TypeScript pro celý stack (frontend, API, workery). Jeden jazyk = sdílené typy napříč monorep, jednodušší CI, menší kognitivní zátěž při přepínání vrstev. Python by byl přirozenější pro AI/scraping, ale výhoda monotypového prostředí převáží.

### Drizzle ORM místo Prisma
Drizzle generuje transparentní SQL, migrační soubory jsou čitelné plain SQL. Prisma je abstrakcí navíc; pro produkt kde je důležité auditovat data operations je Drizzle čitelnější.

### BullMQ + Redis místo jednoduššího task runneru
Pipeline má 10 kroků s různými failure modes, retry potřebami a paralelismem. BullMQ dává viditelnost do stavu fronty, přirozené retry s exponential backoff, a oddělení workerů do izolovaných procesů. Jednodušší alternativy (pg-boss, inline async) by neunestly komplexitu pipeline.

### Fastify místo NestJS pro API
MVP nepotřebuje full-framework s DI kontejnerem. Fastify je rychlé, nativně typované a JSON-schema aware. NestJS je vhodný pokud tým preferuje strukturu — lze migrovat pokud vyroste potřeba.

### CLI prototyp (Etapa 0) před UI
Nejdražší chyba by bylo postavit celý webový stack a zjistit, že pipeline nefunguje na reálných URL. CLI spike ověří kvalitu extrakce, AI náklady a míru ruční kontroly za ~1–2 týdny. Teprve po GO/REWORK rozhodnutí má smysl investovat do UI.

### MinIO lokálně, Cloudflare R2 v produkci
R2 nemá egress poplatky za čtení (na rozdíl od AWS S3), což je výhodné pro preview obrázků v review UI. MinIO je S3-kompatibilní, takže přepnutí vyžaduje jen env vars.

### OpenAI Structured Outputs místo function calling nebo free-form JSON
Structured Outputs garantují JSON schema compliance i pro komplexní výstupy. Free-form JSON vyžaduje error-prone parsing. Function calling je vhodný pro akce, ne pro data extraction.

### Zod pro validaci na všech hranicích
Jeden validační framework pro: API vstupy, AI výstupy, export schémata, URL validaci. Zod + inference TypeScript typů eliminuje duplikaci type definitions.
