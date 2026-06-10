import { z } from 'zod'

export const CategorizationOutputSchema = z.object({
  primaryCategoryId: z.string(),
  alternativeCategoryIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
})

export type CategorizationOutput = z.infer<typeof CategorizationOutputSchema>
