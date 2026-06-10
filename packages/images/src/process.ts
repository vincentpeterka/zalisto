import sharp from 'sharp'
import { createHash } from 'node:crypto'

const MAX_DIMENSION = 1600
const WEBP_QUALITY = 80

export interface ProcessResult {
  webpBuffer: Buffer
  width: number
  height: number
  sizeBytes: number
  hash: string
}

export async function processImage(originalBuffer: Buffer): Promise<ProcessResult> {
  const hash = createHash('sha256').update(originalBuffer).digest('hex')

  const webpBuffer = await sharp(originalBuffer)
    .rotate() // auto-orient from EXIF
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  const meta = await sharp(webpBuffer).metadata()

  return {
    webpBuffer,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    sizeBytes: webpBuffer.length,
    hash,
  }
}
