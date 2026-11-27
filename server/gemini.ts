import { GoogleGenAI } from '@google/genai'

const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen'

const DEPRECATED_MODELS = new Set([
  'gemini-pro',
  'gemini-pro-vision',
  'gemini-1.0-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-pro',
])

export function getGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim()
  return configured || DEFAULT_GEMINI_MODEL
}

export const GEMINI_MODEL = getGeminiModel()

export class GeminiError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new GeminiError(
      'Gemini API key is not configured. Set GEMINI_API_KEY on the server to enable AI features.',
      503
    )
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

export async function validateGeminiConfig(): Promise<{ ok: boolean; model: string; reason?: string }> {
  const model = getGeminiModel()
  const lowerModel = model.toLowerCase()

  if (
    DEPRECATED_MODELS.has(lowerModel) ||
    lowerModel.startsWith('gemini-1.') ||
    lowerModel.startsWith('gemini-2.0')
  ) {
    const reason = `Configured GEMINI_MODEL "${model}" is deprecated or unsupported. Update GEMINI_MODEL in .env to a current model such as "${DEFAULT_GEMINI_MODEL}".`
    console.error(`[Gemini Startup Check] ERROR: ${reason}`)
    return { ok: false, model, reason }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    const reason = `GEMINI_API_KEY is missing. AI endpoints will return 503 until GEMINI_API_KEY is configured (model configured: "${model}").`
    console.warn(`[Gemini Startup Check] WARNING: ${reason}`)
    return { ok: false, model, reason }
  }

  try {
    const ai = getGeminiClient()
    await ai.models.get({ model })
    console.log(`[Gemini Startup Check] OK: Verified model "${model}" with configured API key.`)
    return { ok: true, model }
  } catch (err) {
    const normalized = normalizeGeminiError(err)
    console.error(`[Gemini Startup Check] ERROR (${normalized.status}): ${normalized.message} (model: "${model}")`)
    return { ok: false, model, reason: normalized.message }
  }
}

export function normalizeGeminiError(err: unknown): { status: number; message: string } {
  if (err instanceof GeminiError) {
    return { status: err.status, message: err.message }
  }

  const rawMsg = err instanceof Error ? err.message : String(err)
  const lower = rawMsg.toLowerCase()

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('invalid api key')) {
    return {
      status: 400,
      message: 'Configured Gemini API key appears invalid. Please verify GEMINI_API_KEY on the server.',
    }
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Permission denied by Gemini API. Please verify your server API key permissions.',
    }
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota reached. Please wait a moment and try again.',
    }
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: `Requested Gemini model ("${getGeminiModel()}") was not found.`,
    }
  }

  return {
    status: 500,
    message: rawMsg || 'Failed to communicate with Gemini API.',
  }
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      const isTransient =
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('timeout') ||
        msg.includes('econnreset')
      if (!isTransient || attempt === maxRetries) {
        throw err
      }
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)))
    }
  }
  throw lastError
}

export function parseJsonResponse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    return fallback
  }
}
