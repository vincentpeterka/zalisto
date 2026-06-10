import { createHash } from 'crypto'
import dns from 'dns/promises'

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^100\.100\.100\.200$/,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
]

const ALLOWED_SCHEMES = ['http:', 'https:']
const MAX_REDIRECTS = 5
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 30_000

export interface FetchResult {
  html: string
  finalUrl: string
  contentType: string
  statusCode: number
  hash: string
}

async function assertSafeHost(hostname: string): Promise<void> {
  let addresses: string[]
  try {
    addresses = await dns.resolve4(hostname)
  } catch {
    try {
      addresses = await dns.resolve6(hostname)
    } catch {
      throw new Error(`DNS resolution failed for host: ${hostname}`)
    }
  }

  for (const ip of addresses) {
    if (PRIVATE_IP_RANGES.some(r => r.test(ip))) {
      throw new Error(`SSRF: resolved IP ${ip} is in a blocked range`)
    }
  }
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const parsed = new URL(url)

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw new Error(`Scheme "${parsed.protocol}" is not allowed. Use http or https.`)
  }

  await assertSafeHost(parsed.hostname)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'cs,en;q=0.9',
      },
    })

    // Handle redirects manually so we can check each hop
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirect without Location header')
      return await followRedirect(location, url, MAX_REDIRECTS - 1)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unexpected content type: ${contentType}`)
    }

    const buffer = await readLimited(response, MAX_RESPONSE_BYTES)
    const html = new TextDecoder().decode(buffer)
    const hash = createHash('sha256').update(buffer).digest('hex')

    return {
      html,
      finalUrl: url,
      contentType,
      statusCode: response.status,
      hash,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function followRedirect(
  location: string,
  base: string,
  remaining: number,
): Promise<FetchResult> {
  if (remaining <= 0) throw new Error('Too many redirects')

  const resolved = new URL(location, base).toString()
  const parsed = new URL(resolved)

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw new Error(`Redirect to blocked scheme: ${parsed.protocol}`)
  }

  await assertSafeHost(parsed.hostname)
  return fetchPage(resolved)
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response has no body')

  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      reader.cancel()
      throw new Error(`Response too large (>${maxBytes} bytes)`)
    }
    chunks.push(value)
  }

  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
