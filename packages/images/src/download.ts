const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const TIMEOUT_MS = 30_000

export interface DownloadResult {
  buffer: Buffer
  mimeType: string
  sizeBytes: number
}

export async function downloadImage(url: string): Promise<DownloadResult> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Zalisto-ImageBot/1.0' },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching image: ${url}`)
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase().trim() ?? ''
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new Error(`Unsupported image MIME type "${contentType}" for ${url}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large: ${buffer.length} bytes (max ${MAX_SIZE_BYTES}) for ${url}`)
  }

  return { buffer, mimeType: contentType, sizeBytes: buffer.length }
}
