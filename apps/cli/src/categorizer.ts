import fs from 'fs/promises'
import { parse } from 'csv-parse/sync'
import OpenAI from 'openai'
import { z } from 'zod'
import type { ProductFact, CategoryMatch } from '@zalisto/domain'

interface CsvCategory {
  id: string
  name: string
  fullPath: string
  parentId?: string | undefined
}

const client = new OpenAI()

const CategorizationSchema = z.object({
  categoryId: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
})

export async function categorize(
  facts: ProductFact[],
  categoriesPath: string,
): Promise<CategoryMatch> {
  const categories = await loadCategories(categoriesPath)

  if (categories.length === 0) {
    throw new Error('No categories found in CSV file')
  }

  // Build fact summary for the prompt
  const factSummary = facts
    .filter(f => f.isSelected && ['title', 'brand', 'description', 'productType'].includes(f.fieldName))
    .map(f => `${f.fieldName}: ${f.normalizedValue ?? String(f.valueJson)}`)
    .join('\n')

  // Limit categories in prompt to avoid token overflow
  const categoryList = categories
    .slice(0, 200)
    .map(c => `${c.id}: ${c.fullPath}`)
    .join('\n')

  const prompt = `Vyber nejlepší kategorii pro tento produkt z dostupného stromu kategorií.

Produkt:
${factSummary}

Dostupné kategorie (id: cesta):
${categoryList}

Vrať JSON s:
- categoryId: ID nejlepší kategorie
- confidence: číslo 0-1 jak jistý jsi si
- reason: krátké vysvětlení proč tato kategorie`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI returned empty response for categorization')

  const parsed = CategorizationSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) throw new Error(`Categorization response invalid: ${parsed.error.message}`)

  const matched = categories.find(c => c.id === parsed.data.categoryId)
  if (!matched) {
    throw new Error(`AI returned unknown category ID: ${parsed.data.categoryId}`)
  }

  return {
    id: matched.id,
    name: matched.name,
    fullPath: matched.fullPath,
    confidence: parsed.data.confidence,
    reason: parsed.data.reason,
  }
}

async function loadCategories(filePath: string): Promise<CsvCategory[]> {
  const content = await fs.readFile(filePath, 'utf-8')

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  return records.map(r => ({
    id: r['id'] ?? r['ID'] ?? String(Math.random()),
    name: r['name'] ?? r['Name'] ?? r['název'] ?? '',
    fullPath: r['fullPath'] ?? r['full_path'] ?? r['path'] ?? r['name'] ?? '',
    parentId: r['parentId'] ?? r['parent_id'] ?? undefined,
  }))
}
