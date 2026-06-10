# Part: Image Pipeline (`packages/images`)

## Účel
Bezpečný download obrázků, Sharp transformace (WebP, resize, orientace) a upload do S3. Deduplication přes SHA-256 hash.

## Pipeline kroky

```
1. Download (s SSRF ochranou)
2. MIME kontrola
3. Velikostní validace
4. SHA-256 hash → dedup check
5. Upload originálu do S3
6. Sharp transformace
7. Upload WebP do S3
8. Uložit metadata do product_images
9. Variantní přiřazení
```

## Download

```typescript
// packages/images/src/downloader.ts
async function downloadImage(url: string): Promise<Buffer> {
  await safeResolveUrl(url)  // SSRF guard — stejný jako v extraction
  
  // Max velikost: 20 MB (před transformací)
  // Timeout: 30s
  // Povolené MIME: image/jpeg, image/png, image/webp, image/gif, image/avif
  // Kontrola skutečného formátu (magic bytes), ne jen Content-Type
}
```

## Sharp Pipeline

```typescript
// packages/images/src/processor.ts
const IMAGE_CONFIG = {
  maxLongEdge: 1600,        // px, bez upscalingu
  webpQuality: 80,
  minWidth: 400,            // pod tím: WARNING small-image
  minHeight: 400,
}

async function processImage(buffer: Buffer, config: ImageConfig) {
  const metadata = await sharp(buffer).metadata()
  
  // 1. Auto-rotate (EXIF orientace)
  let pipeline = sharp(buffer).rotate()
  
  // 2. Resize (pouze downscale)
  const longEdge = Math.max(metadata.width!, metadata.height!)
  if (longEdge > config.maxLongEdge) {
    pipeline = pipeline.resize(config.maxLongEdge, config.maxLongEdge, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  
  // 3. WebP konverze
  const webpBuffer = await pipeline.webp({ quality: config.webpQuality }).toBuffer()
  return { webpBuffer, metadata }
}
```

## S3 Storage Keys

```
Originál:  {orgId}/{batchId}/{productId}/orig/{hash}.{ext}
WebP:      {orgId}/{batchId}/{productId}/webp/{hash}.webp
```

## Deduplication

Před uploadem zkontrolovat `source_hash` v `product_images` pro stejný `product_draft_id`.
Pokud hash existuje → skip upload, reuse existující storage key.

## Naming pro export

```typescript
// packages/images/src/naming.ts
function exportImageName(brand: string, model: string, index: number): string {
  const base = `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base}-${String(index).padStart(2, '0')}.webp`
}
// Výstup: "samsung-galaxy-s25-ultra-01.webp"
```

## Variantní přiřazení

```typescript
// Pokud obrázek obsahuje variantní identifikátor v URL (barva, pattern):
// → pokusit se matching přes option_values variant
// → jinak: přiřadit jako obecný obrázek produktu (variant_id = null)
// → sort_order: hlavní obrázek = 0, galerie = 1+
```

## Validační checks (pro validation-rules)

- `status = 'TOO_SMALL'` pokud width < minWidth OR height < minHeight
- `status = 'FAILED'` pokud download nebo MIME kontrola selhala
- `status = 'PROCESSED'` po úspěšném WebP upload
