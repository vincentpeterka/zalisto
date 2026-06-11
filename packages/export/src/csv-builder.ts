import type { BlockedProduct, SourceReportRow } from './types.js'

function escapeCsv(value: string | null | undefined): string {
  const str = value ?? ''
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function csvRow(values: (string | null | undefined)[]): string {
  return values.map(escapeCsv).join(',')
}

export function buildValidationReport(blocked: BlockedProduct[]): Buffer {
  const header = csvRow(['ID', 'EAN', 'Název', 'Výrobce', 'Zdroj URL', 'Blokéry', 'Chyby'])
  const rows = blocked.map(p =>
    csvRow([
      p.id,
      p.gtin,
      p.titleCs,
      p.brand,
      p.sourceUrl,
      p.blockerCodes.join('; '),
      p.errorCodes.join('; '),
    ])
  )
  return Buffer.from([header, ...rows].join('\n'), 'utf-8')
}

export function buildSourceReport(rows: SourceReportRow[]): Buffer {
  const header = csvRow(['Zdroj URL', 'ID produktu', 'Název', 'Status', 'EAN'])
  const dataRows = rows.map(r =>
    csvRow([r.sourceUrl, r.productId, r.title, r.status, r.gtin])
  )
  return Buffer.from([header, ...dataRows].join('\n'), 'utf-8')
}
