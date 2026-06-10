export interface FactRow {
  fieldName: string
  valueJson: unknown
  confidence: string | null
}

/** Return the string value of the fact with highest confidence for the given field. */
export function bestFactValue(facts: FactRow[], field: string): string | null {
  const candidates = facts
    .filter(f => f.fieldName === field && f.valueJson != null)
    .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0))

  const top = candidates[0]
  if (!top) return null
  const v = top.valueJson
  return typeof v === 'string' ? v : String(v)
}
