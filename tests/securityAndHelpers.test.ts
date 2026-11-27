import { describe, expect, it, afterEach } from 'vitest'
import {
  checkCodeRunRateLimit,
  CodeRunnerError,
  executeSandboxedCode,
} from '../server/codeRunner.ts'
import {
  getGeminiModel,
  normalizeGeminiError,
  parseJsonResponse,
  validateGeminiConfig,
} from '../server/gemini.ts'
import {
  extractYouTubeVideoId,
  YouTubeTranscriptError,
} from '../server/youtube.ts'

describe('server security and AI helpers', () => {
  const originalModel = process.env.GEMINI_MODEL
  const originalKey = process.env.GEMINI_API_KEY
  const originalRunnerUrl = process.env.CODE_RUNNER_API_URL
  const originalRunnerDriver = process.env.CODE_RUNNER_DRIVER

  afterEach(() => {
    process.env.GEMINI_MODEL = originalModel
    process.env.GEMINI_API_KEY = originalKey
    process.env.CODE_RUNNER_API_URL = originalRunnerUrl
    process.env.CODE_RUNNER_DRIVER = originalRunnerDriver
  })

  it('extracts valid YouTube video IDs and rejects non-YouTube hosts (SSRF protection)', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')

    expect(() => extractYouTubeVideoId('http://127.0.0.1:8080/watch?v=dQw4w9WgXcQ')).toThrow(
      YouTubeTranscriptError
    )
    expect(() => extractYouTubeVideoId('ftp://youtube.com/watch?v=dQw4w9WgXcQ')).toThrow(
      YouTubeTranscriptError
    )
  })

  it('validates Gemini model config and normalizes API errors', async () => {
    delete process.env.GEMINI_MODEL
    expect(getGeminiModel()).toBe('gemini-4-hydrogen')

    process.env.GEMINI_MODEL = 'gemini-1.5-flash'
    const check = await validateGeminiConfig()
    expect(check.ok).toBe(false)
    expect(check.reason).toContain('deprecated')

    const parsed = parseJsonResponse<{ a: number }>('```json\n{"a": 42}\n```', { a: 0 })
    expect(parsed.a).toBe(42)

    expect(normalizeGeminiError(new Error('RESOURCE_EXHAUSTED 429')).status).toBe(429)
  })

  it('enforces sandbox configuration and per-user rate limits in codeRunner', async () => {
    delete process.env.CODE_RUNNER_API_URL
    delete process.env.CODE_RUNNER_DRIVER

    await expect(executeSandboxedCode('user-unconf', 'python', 'print(1)')).rejects.toMatchObject({
      name: 'CodeRunnerError',
      status: 503,
    })

    const rateKey = `rate-test-${Date.now()}`
    for (let i = 0; i < 12; i++) {
      checkCodeRunRateLimit(rateKey)
    }
    expect(() => checkCodeRunRateLimit(rateKey)).toThrow(CodeRunnerError)
    try {
      checkCodeRunRateLimit(rateKey)
    } catch (err) {
      expect((err as CodeRunnerError).status).toBe(429)
    }
  })
})
