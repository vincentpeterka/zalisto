# Part: Crawler & Extraction (`apps/crawler` + `packages/extraction`)

## Účel
Bezpečný HTTP fetch produktových stránek a extrakce strukturovaných faktů z HTML.

## Komponenty

### SSRF Guard (bezpečnostní vrstva — vždy první)
```typescript
// packages/extraction/src/ssrf-guard.ts
async function safeResolveUrl(url: string): Promise<void> {
  // 1. Parse URL — pouze http/https
  // 2. DNS resolve
  // 3. Kontrola každé IP v odpovědi:
  //    - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 → BLOCK
  //    - 127.0.0.0/8, ::1 → BLOCK
  //    - 169.254.0.0/16 (link-local + cloud metadata) → BLOCK
  //    - 100.100.100.200 (Alibaba metadata) → BLOCK
  // 4. Port whitelist: 80, 443 pouze
}
```

### HTTP Fetcher
```typescript
// packages/extraction/src/http-fetcher.ts
// - User-Agent: realistický browser string
// - Timeout: 15s connect, 30s response
// - Max response size: 5 MB
// - Max redirects: 5 (kontrola každého hopu přes SSRF guard)
// - Accept-Language: cs,en
// - Uložit: status code, content-type, response headers, SHA-256 hash těla
```

### JSON-LD Extractor
```typescript
// packages/extraction/src/jsonld-extractor.ts
// Parsuje všechny <script type="application/ld+json"> bloky
// Hledá: @type Product, Offer, AggregateOffer, BreadcrumbList
// Mapuje na ProductFact[] se sourceType: SOURCE_PAGE
```

### HTML Heuristics
```typescript
// packages/extraction/src/html-heuristics.ts
// Cheerio selektory pro:
// - Cena: [itemprop="price"], .price, #price, data-price
// - SKU: [itemprop="sku"], data-sku
// - EAN/GTIN: [itemprop="gtin"], hledání 8/13/14 číslic v parametrech
// - Obrázky: [itemprop="image"], OG image, product gallery
// - Varianty: select[name="variant"], data-variant atributy
// - Breadcrumbs: nav[aria-label="breadcrumb"], .breadcrumb
// - Parametry: tabulky s technickými specs
```

### Vendor Adapter Interface
```typescript
// packages/extraction/src/vendor-adapter.ts
interface VendorAdapter {
  canHandle(url: string): boolean
  extract(html: string, url: string): Promise<ProductFact[]>
}
// Registr adaptérů — první match vyhrává
// Fallback: obecné heuristiky
```

### Playwright Fallback
```typescript
// apps/crawler/src/browser-worker.ts
// Používat POUZE pokud HTTP fetch nepřinesl produktová data
// Spouštět v izolovaném Docker kontejneru (browser-service)
// Timeout: 30s page load + 10s po load
// Bez přístupu na: localhost, interní services, file://
// Bez stahování souborů
// Po extrakci: zavřít browser context
```

## BullMQ Job Flow

```
fetch-source job → { sourceItemId }
  → safeResolveUrl()
  → httpFetch()
  → uploadRawHtml(S3)
  → updateSourceItem({ fetchStatus: 'DONE', contentHash, rawHtmlStorageKey })
  → enqueue extract-product

extract-product job → { sourceItemId }
  → loadRawHtml(S3)
  → tryJsonLd() → facts[]
  → tryOpenGraph() → facts[]
  → tryHtmlHeuristics() → facts[]
  → tryVendorAdapter() → facts[] (override/complement)
  → insertProductFacts()
  → if (insufficient) → enqueue browser-extract
  → else → enqueue identify-product
```

## Testování

Každý vendor adaptér má fixture test:
```
packages/extraction/fixtures/
  vendor-abc/
    product-1.html    (uložená HTML stránka)
    product-1.json    (expected extracted facts)
```

Testy nesmí dělat HTTP requesty — pracují výhradně s fixturami.
