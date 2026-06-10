const VALID_LENGTHS = new Set([8, 13, 14])

export type GtinType = 'EAN-8' | 'EAN-13' | 'GTIN-14'

export interface GtinValidationResult {
  valid: boolean
  normalized: string | null
  type: GtinType | null
  error?: string
}

function gtinType(len: number): GtinType | null {
  if (len === 8) return 'EAN-8'
  if (len === 13) return 'EAN-13'
  if (len === 14) return 'GTIN-14'
  return null
}

function gs1CheckDigit(digits: number[]): number {
  // weights alternate 3/1 from right (excluding check digit)
  const data = digits.slice(0, -1)
  const sum = data.reduceRight((acc, d, i) => {
    const distFromRight = data.length - 1 - i
    return acc + d * (distFromRight % 2 === 0 ? 3 : 1)
  }, 0)
  return (10 - (sum % 10)) % 10
}

export function validateGtin(raw: string): GtinValidationResult {
  const normalized = raw.trim().replace(/[\s-]/g, '')

  if (!/^\d+$/.test(normalized)) {
    return { valid: false, normalized: null, type: null, error: 'GTIN_NON_NUMERIC' }
  }

  if (!VALID_LENGTHS.has(normalized.length)) {
    return { valid: false, normalized: null, type: null, error: 'GTIN_INVALID_LENGTH' }
  }

  const digits = normalized.split('').map(Number)
  const expected = gs1CheckDigit(digits)
  const actual = digits[digits.length - 1]!

  if (expected !== actual) {
    return {
      valid: false,
      normalized: null,
      type: gtinType(normalized.length),
      error: 'GTIN_INVALID_CHECKSUM',
    }
  }

  return { valid: true, normalized, type: gtinType(normalized.length), error: undefined }
}

/** Pad EAN-13 to GTIN-14 (prepend 0) if needed, otherwise return as-is */
export function toGtin14(gtin: string): string {
  if (gtin.length === 13) return '0' + gtin
  if (gtin.length === 8) return '000000' + gtin
  return gtin
}
