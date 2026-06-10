export interface FlatCategory {
  id: string
  name: string
  fullPath: string
  active: boolean
}

/**
 * Formats a flat category list for use in AI prompts.
 * Truncates to maxItems to stay within token budget.
 */
export function formatCategoryTree(categories: FlatCategory[], maxItems = 200): string {
  return categories
    .filter(c => c.active)
    .slice(0, maxItems)
    .map(c => `${c.id}: ${c.fullPath}`)
    .join('\n')
}
