import OpenAI from 'openai'
import type { ZodType } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'

export interface CallOptions<T> {
  model?: string
  systemPrompt: string
  userPrompt: string
  schema: ZodType<T>
  schemaName: string
}

export interface CallResult<T> {
  data: T
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number }
}

// Rough pricing for gpt-4o-mini (input $0.15/1M, output $0.60/1M)
const COST_PER_INPUT_TOKEN = 0.15 / 1_000_000
const COST_PER_OUTPUT_TOKEN = 0.60 / 1_000_000

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
  return _client
}

export async function callStructured<T>(opts: CallOptions<T>): Promise<CallResult<T>> {
  const model = opts.model ?? 'gpt-4o-mini'
  const client = getClient()

  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.beta.chat.completions.parse({
        model,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
        response_format: zodResponseFormat(opts.schema, opts.schemaName),
        temperature: 0.2,
      })

      const parsed = response.choices[0]?.message.parsed
      if (!parsed) throw new Error('OpenAI returned no parsed output')

      const inputTokens = response.usage?.prompt_tokens ?? 0
      const outputTokens = response.usage?.completion_tokens ?? 0

      return {
        data: parsed,
        usage: {
          inputTokens,
          outputTokens,
          estimatedCostUsd: inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN,
        },
      }
    } catch (err: unknown) {
      lastError = err
      const status = (err as { status?: number }).status
      // Retry on rate limit (429) or server errors (5xx)
      if (attempt < 3 && (status === 429 || (status && status >= 500))) {
        await sleep(Math.pow(2, attempt) * 1000)
        continue
      }
      throw err
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
