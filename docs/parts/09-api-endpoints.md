# Part: API Endpoints (`apps/api`)

## Účel
Fastify REST API — auth, CRUD operace, stavové přechody, export endpointy. Veškerá business logika je v packages, API jen orchestruje.

## Auth

```http
POST /auth/login          { email, password } → session cookie
POST /auth/logout         → clear session
GET  /auth/me             → { id, email, displayName, orgs[] }
```

Session: httpOnly cookie, SameSite=Strict, Secure (prod).
Hesla: bcrypt s cost factor 12.

## Organizace a projekty

```http
GET    /orgs                        → organizace uživatele
GET    /orgs/:orgId/members         → členové

GET    /projects                    → projekty v org (z session)
POST   /projects                    { name, targetLanguage, targetCurrency, pricingConfig, ... }
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id

POST   /projects/:id/categories/import    CSV upload → strom kategorií
GET    /projects/:id/categories           → kategorie
```

## Dávky

```http
POST /projects/:id/batches          { name? } → { batchId }
GET  /projects/:id/batches          → seznam dávek s progress

GET  /batches/:id                   → detail dávky
POST /batches/:id/items             { urls: string[] } nebo multipart CSV/XLSX
POST /batches/:id/process           → spustí pipeline (enqueue)
GET  /batches/:id/status            → live progress (SSE nebo polling)
```

## Produkty

```http
GET   /batches/:id/products         → seznam produktů (filtry, paginace)
GET   /products/:id                 → detail + facts + images + issues
PATCH /products/:id                 { brand?, titleCs?, categoryId?, ... } → review_decision
POST  /products/:id/approve         → status = APPROVED
POST  /products/:id/reject          { reason } → status = NEEDS_REVIEW + note
POST  /products/:id/reprocess       → znovu spustit pipeline od extrakce
POST  /batches/:id/approve-all      → hromadné schválení (jen READY_FOR_REVIEW bez BLOCKER)
```

## Validace issues

```http
GET  /products/:id/issues           → validation issues
POST /issues/:id/resolve            { note? } → resolved = true (pouze ADMIN+)
```

## Export

```http
POST /batches/:id/exports           { format: 'SHOPTET_XLSX' | 'CSV' | 'ZIP' }
GET  /exports/:id                   → stav exportu
GET  /exports/:id/download          → redirect na signed S3 URL (TTL 1h)
```

## Error formát

```json
{
  "error": "Popis chyby pro vývojáře",
  "code": "VALIDATION_ERROR",
  "details": { "field": "urls", "message": "Invalid URL format" }
}
```

HTTP status kódy:
- 400: validační chyba vstupu
- 401: nepřihlášen
- 403: nedostatečná role
- 404: entita neexistuje nebo nenáleží org
- 409: konflikt (duplikát)
- 422: business rule violation
- 500: neočekávaná chyba (Sentry alert)

## Autorizace (Fastify plugin)

```typescript
// Každý route handler ověřuje:
// 1. Platná session
// 2. Entita patří organizaci z session (row-level)
// 3. Uživatel má požadovanou roli

// Role požadavky:
// REVIEWER: GET /products, GET /batches, POST /approve
// ADMIN: PATCH /products, POST /resolve, POST /exports
// OWNER: DELETE /projects, správa členů
```

## Paginace

```
GET /batches/:id/products?page=1&pageSize=50&status=NEEDS_REVIEW
→ { data: Product[], total: 200, page: 1, pageSize: 50 }
```
