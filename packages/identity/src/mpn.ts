/** Strip everything except alphanumeric and hyphen, collapse to lowercase */
export function normalizeMpn(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '')
}

/** Lowercase and collapse whitespace */
export function normalizeBrand(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
