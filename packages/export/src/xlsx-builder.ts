import ExcelJS from 'exceljs'
import type { ApprovedProduct } from './types.js'

const MAX_IMAGES = 10

export const SHOPTET_COLUMNS = [
  'Kód',
  'Název',
  'Krátký popis',
  'Popis',
  'Výrobce',
  'Kód výrobce',
  'EAN',
  'Cena s DPH',
  'Sazba DPH',
  'Kategorie',
  'Aktivní',
  ...Array.from({ length: MAX_IMAGES }, (_, i) => `Obrázek ${i + 1}`),
]

function productCode(p: ApprovedProduct): string {
  return p.gtin ?? p.manufacturerPartNumber ?? p.id.slice(0, 8)
}

export async function buildShoptetXlsx(products: ApprovedProduct[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Produkty')

  ws.columns = SHOPTET_COLUMNS.map(header => ({
    header,
    key: header,
    width: header.startsWith('Obrázek') ? 40 : 25,
  }))

  // Bold header row
  ws.getRow(1).font = { bold: true }

  for (const p of products) {
    const imageFilenames = p.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, MAX_IMAGES)
      .map(img => img.webpFilename)

    const imageColumns: Record<string, string> = {}
    for (let i = 0; i < MAX_IMAGES; i++) {
      imageColumns[`Obrázek ${i + 1}`] = imageFilenames[i] ?? ''
    }

    ws.addRow({
      'Kód': productCode(p),
      'Název': p.titleCs ?? '',
      'Krátký popis': p.shortDescriptionCs ?? '',
      'Popis': p.longDescriptionCs ?? '',
      'Výrobce': p.brand ?? '',
      'Kód výrobce': p.manufacturerPartNumber ?? '',
      'EAN': p.gtin ?? '',
      'Cena s DPH': p.targetPrice ? parseFloat(p.targetPrice) : '',
      'Sazba DPH': p.vatRate ? parseFloat(p.vatRate) : '',
      'Kategorie': p.categoryFullPath ?? '',
      'Aktivní': 'Ano',
      ...imageColumns,
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
