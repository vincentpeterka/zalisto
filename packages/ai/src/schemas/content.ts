import { z } from 'zod'

export const ContentOutputSchema = z.object({
  titleCs: z.string().min(5).max(200),
  shortDescriptionCs: z.string().max(500),
  longDescriptionCs: z.string().max(5000),
  bulletPoints: z.array(z.string()).max(10),
  warnings: z.array(z.string()),
  usedFactIds: z.array(z.string().uuid()),
})

export type ContentOutput = z.infer<typeof ContentOutputSchema>
