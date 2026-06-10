export type GtinType = 'EAN8' | 'EAN13' | 'GTIN14' | 'INVALID_LENGTH'

export interface EanResult {
  valid: boolean
  type: GtinType
  normalized: string
}

export function validateEan(raw: string): EanResult {
  const digits = raw.replace(/\D/g, '')

  if (digits.length === 8) return { ...checkEan(digits), type: 'EAN8', normalized: digits }
  if (digits.length === 13) return { ...checkEan(digits), type: 'EAN13', normalized: digits }
  if (digits.length === 14) return { ...checkGtin14(digits), type: 'GTIN14', normalized: digits }

  // EAN padded with leading zeros (e.g. 12-digit → pad to 13)
  if (digits.length === 12) {
    const padded = '0' + digits
    return { ...checkEan(padded), type: 'EAN13', normalized: padded }
  }

  return { valid: false, type: 'INVALID_LENGTH', normalized: digits }
}

function checkEan(digits: string): { valid: boolean } {
  // GS1 checksum: alternating weights 1 and 3 from left, last digit is check digit
  let sum = 0
  for (let i = 0; i < digits.length - 1; i++) {
    const weight = i % 2 === 0 ? 1 : 3
    sum += parseInt(digits[i]!, 10) * weight
  }
  const check = (10 - (sum % 10)) % 10
  return { valid: check === parseInt(digits[digits.length - 1]!, 10) }
}

function checkGtin14(digits: string): { valid: boolean } {
  // GTIN-14 uses same GS1 checksum algorithm but with alternating weights 3 and 1 from left
  let sum = 0
  for (let i = 0; i < 13; i++) {
    const weight = i % 2 === 0 ? 3 : 1
    sum += parseInt(digits[i]!, 10) * weight
  }
  const check = (10 - (sum % 10)) % 10
  return { valid: check === parseInt(digits[13]!, 10) }
}
