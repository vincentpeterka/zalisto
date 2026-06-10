import sharp from 'sharp'
import { createHash } from 'crypto'
import type { ProductImage, ProcessedImage } from '@zalisto/domain'

const MAX_LONG_EDGE = 1600
const WEBP_QUALITY = 80
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 30_000

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

export async function processImages(images: ProductImage[]): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = []

  for (const img of images) {
    try {
      const processed = await processSingleImage(img)
      results.push(processed)
    } catch (err) {
      console.warn(`      Image failed (${img.sourceUrl.slice(0, 60)}...): ${err instanceof Error ? err.message : err}`)
    }
  }

  return results
}

async function processSingleImage(img: ProductImage): Promise<ProcessedImage> {
  const buffer = await downloadImage(img.sourceUrl)

  // Verify actual content type by magic bytes
  assertValidImageMagic(buffer)

  const hash = createHash('sha256').update(buffer).digest('hex')

  const metadata = await sharp(buffer).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  // Build Sharp pipeline
  let pipeline = sharp(buffer).rotate() // auto-orient via EXIF

  const longEdge = Math.max(width, height)
  if (longEdge > MAX_LONG_EDGE) {
    pipeline = pipeline.resize(MAX_LONG_EDGE, MAX_LONG_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  const webpBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()
  const webpMeta = await sharp(webpBuffer).metadata()

  return {
    sourceUrl: img.sourceUrl,
    webpBuffer,
    width: webpMeta.width ?? width,
    height: webpMeta.height ?? height,
    sizeBytes: webpBuffer.length,
    hash,
    sortOrder: img.sortOrder,
  }
}

async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZalistoBot/1.0)',
        'Accept': 'image/*',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    if (!ALLOWED_MIME.has(contentType) && !contentType.startsWith('image/')) {
      throw new Error(`Unexpected content type: ${contentType}`)
    }

    const chunks: Uint8Array[] = []
    let total = 0
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_DOWNLOAD_BYTES) {
        reader.cancel()
        throw new Error(`Image too large (>${MAX_DOWNLOAD_BYTES} bytes)`)
      }
      chunks.push(value)
    }

    const result = Buffer.allocUnsafe(total)
    let offset = 0
    for (const chunk of chunks) {
      Buffer.from(chunk).copy(result, offset)
      offset += chunk.length
    }
    return result
  } finally {
    clearTimeout(timer)
  }
}

function assertValidImageMagic(buffer: Buffer): void {
  // Check magic bytes for common image formats
  const jpg = buffer[0] === 0xff && buffer[1] === 0xd8
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  const avif = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70
  const gif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46

  if (!jpg && !png && !webp && !avif && !gif) {
    throw new Error('File does not appear to be a valid image (magic bytes check failed)')
  }
}

export function exportImageFilename(brand: string | undefined, model: string | undefined, index: number): string {
  const base = `${brand ?? 'product'}-${model ?? 'image'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base}-${String(index).padStart(2, '0')}.webp`
}
