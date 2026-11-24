import { GoogleGenAI } from '@google/genai'

export const GEMINI_MODEL = 'gemini-4-hydrogen'

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
      'Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets.',
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

export function normalizeGeminiError(err: unknown): { status: number; message: string } {
  if (err instanceof GeminiError) {
    return { status: err.status, message: err.message }
  }

  const rawMsg = err instanceof Error ? err.message : String(err)
  const lower = rawMsg.toLowerCase()

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('invalid api key')) {
    return {
      status: 400,
      message: 'Your Gemini API key appears invalid. Please check GEMINI_API_KEY in Settings > Secrets.',
    }
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Permission denied by Gemini API. Please verify your API key in Settings > Secrets.',
    }
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota reached. Please wait a moment or check your billing/quota in Settings > Secrets.',
    }
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: `Requested Gemini model was not found: ${rawMsg}`,
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
