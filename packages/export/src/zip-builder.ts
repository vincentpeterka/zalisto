import JSZip from 'jszip'
import type { ExportManifest } from './types.js'

export interface ZipImage {
  filename: string
  buffer: Buffer
}

export interface ZipReport {
  filename: string
  buffer: Buffer
}

export async function buildExportZip(
  xlsxBuffer: Buffer,
  images: ZipImage[],
  reports: ZipReport[],
  manifest: ExportManifest,
): Promise<Buffer> {
  const zip = new JSZip()

  zip.file('shoptet-import.xlsx', xlsxBuffer)
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  for (const report of reports) {
    zip.file(report.filename, report.buffer)
  }

  const imgFolder = zip.folder('images')!
  for (const img of images) {
    imgFolder.file(img.filename, img.buffer)
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return buffer
}
