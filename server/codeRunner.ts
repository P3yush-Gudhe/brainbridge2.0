import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export type SupportedLanguage = 'python' | 'javascript' | 'typescript' | 'cpp' | 'java' | 'c'

export interface CodeRunResult {
  stdout: string
  stderr: string
  exitCode: number
  driver: 'external-api' | 'docker'
}

export class CodeRunnerError extends Error {
  status: number
  retryAfterSeconds?: number
  constructor(message: string, status = 500, retryAfterSeconds?: number) {
    super(message)
    this.name = 'CodeRunnerError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Per-user sliding window rate limiter (default: 12 runs / 60s)
const userRunTimestamps = new Map<string, number[]>()
const MAX_RUNS_PER_WINDOW = 12
const WINDOW_MS = 60_000

export function checkCodeRunRateLimit(userKey: string): void {
  const now = Date.now()
  const recent = (userRunTimestamps.get(userKey) ?? []).filter((ts) => now - ts < WINDOW_MS)
  if (recent.length >= MAX_RUNS_PER_WINDOW) {
    const oldest = recent[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000))
    userRunTimestamps.set(userKey, recent)
    throw new CodeRunnerError(
      `Code execution rate limit reached (${MAX_RUNS_PER_WINDOW} runs/minute). Try again in ${retryAfter}s.`,
      429,
      retryAfter
    )
  }
  recent.push(now)
  userRunTimestamps.set(userKey, recent)
}

const LANGUAGE_RUNTIME_MAP: Record<
  SupportedLanguage,
  { pistonLang: string; pistonVersion: string; filename: string; dockerImage: string; dockerCmd: string }
> = {
  python: {
    pistonLang: 'python',
    pistonVersion: '3.10.0',
    filename: 'main.py',
    dockerImage: 'python:3.11-alpine',
    dockerCmd: 'python3 /work/main.py',
  },
  javascript: {
    pistonLang: 'javascript',
    pistonVersion: '18.15.0',
    filename: 'main.js',
    dockerImage: 'node:20-alpine',
    dockerCmd: 'node /work/main.js',
  },
  typescript: {
    pistonLang: 'typescript',
    pistonVersion: '5.0.3',
    filename: 'main.ts',
    dockerImage: 'node:22-alpine',
    dockerCmd: 'node --experimental-strip-types /work/main.ts',
  },
  c: {
    pistonLang: 'c',
    pistonVersion: '10.2.0',
    filename: 'main.c',
    dockerImage: 'gcc:13-alpine',
    dockerCmd: 'gcc /work/main.c -O2 -o /tmp/a.out && /tmp/a.out',
  },
  cpp: {
    pistonLang: 'c++',
    pistonVersion: '10.2.0',
    filename: 'main.cpp',
    dockerImage: 'gcc:13-alpine',
    dockerCmd: 'g++ /work/main.cpp -std=c++17 -O2 -o /tmp/a.out && /tmp/a.out',
  },
  java: {
    pistonLang: 'java',
    pistonVersion: '15.0.2',
    filename: 'Main.java',
    dockerImage: 'eclipse-temurin:21-jdk-alpine',
    dockerCmd: 'cp /work/Main.java /tmp/Main.java && cd /tmp && javac Main.java && java Main',
  },
}

function validateRunnerApiUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new CodeRunnerError('Invalid CODE_RUNNER_API_URL configured on server.', 500)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CodeRunnerError('CODE_RUNNER_API_URL must use http or https protocol.', 500)
  }
  return parsed
}

async function runViaExternalApi(
  apiUrl: string,
  language: SupportedLanguage,
  code: string
): Promise<CodeRunResult> {
  const target = validateRunnerApiUrl(apiUrl)
  const runtime = LANGUAGE_RUNTIME_MAP[language]
  const apiKey = process.env.CODE_RUNNER_API_KEY?.trim()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
      headers['X-API-Key'] = apiKey
    }

    const resp = await fetch(target.toString(), {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        language: runtime.pistonLang,
        version: runtime.pistonVersion,
        files: [{ name: runtime.filename, content: code }],
        compile_timeout: 5000,
        run_timeout: 5000,
        compile_memory_limit: 128 * 1024 * 1024,
        run_memory_limit: 128 * 1024 * 1024,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new CodeRunnerError(
        `Sandbox runner API failed (${resp.status})${errText ? `: ${errText.slice(0, 180)}` : ''}`,
        502
      )
    }

    const data = (await resp.json()) as {
      compile?: { stdout?: string; stderr?: string; code?: number }
      run?: { stdout?: string; stderr?: string; code?: number; signal?: string }
      stdout?: string
      stderr?: string
      exitCode?: number
    }

    if (data.compile && (data.compile.code ?? 0) !== 0) {
      return {
        stdout: data.compile.stdout || '',
        stderr: data.compile.stderr || 'Compilation failed',
        exitCode: data.compile.code ?? 1,
        driver: 'external-api',
      }
    }

    if (data.run) {
      return {
        stdout: data.run.stdout || '',
        stderr: data.run.stderr || (data.run.signal ? `Terminated by signal ${data.run.signal}` : ''),
        exitCode: data.run.code ?? 0,
        driver: 'external-api',
      }
    }

    return {
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exitCode: typeof data.exitCode === 'number' ? data.exitCode : 0,
      driver: 'external-api',
    }
  } catch (err) {
    if (err instanceof CodeRunnerError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        stdout: '',
        stderr: 'Execution timed out after 5s inside external sandbox.',
        exitCode: 124,
        driver: 'external-api',
      }
    }
    throw new CodeRunnerError('Failed to reach external sandbox runner API.', 502)
  } finally {
    clearTimeout(timeout)
  }
}

async function runViaDockerSandbox(
  language: SupportedLanguage,
  code: string
): Promise<CodeRunResult> {
  const runtime = LANGUAGE_RUNTIME_MAP[language]
  const tmpDir = path.join(os.tmpdir(), `studymate-sandbox-${crypto.randomBytes(8).toString('hex')}`)
  await fs.mkdir(tmpDir, { recursive: true, mode: 0o755 })

  try {
    const codeFile = path.join(tmpDir, runtime.filename)
    await fs.writeFile(codeFile, code, { encoding: 'utf8', mode: 0o444 })

    return await new Promise<CodeRunResult>((resolve, reject) => {
      const dockerArgs = [
        'run',
        '--rm',
        '--network=none',
        '--memory=128m',
        '--memory-swap=128m',
        '--cpus=0.5',
        '--pids-limit=64',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=16m',
        '-v',
        `${tmpDir}:/work:ro`,
        runtime.dockerImage,
        'sh',
        '-c',
        runtime.dockerCmd,
      ]

      execFile(
        'docker',
        dockerArgs,
        { timeout: 5000, maxBuffer: 256 * 1024 },
        (error, stdout, stderr) => {
          if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(
              new CodeRunnerError(
                'Docker sandbox is selected (CODE_RUNNER_DRIVER=docker), but the docker CLI is not installed on this host.',
                503
              )
            )
            return
          }
          if (error && 'killed' in error && error.killed) {
            resolve({
              stdout: stdout || '',
              stderr: `${stderr || ''}\nExecution timed out after 5s limit.`.trim(),
              exitCode: 124,
              driver: 'docker',
            })
            return
          }
          const codeNum =
            typeof (error as unknown as { code?: unknown } | null)?.code === 'number'
              ? ((error as unknown as { code: number }).code ?? 1)
              : error
                ? 1
                : 0
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: codeNum,
            driver: 'docker',
          })
        }
      )
    })
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function executeSandboxedCode(
  userKey: string,
  languageRaw: string,
  code: string
): Promise<CodeRunResult> {
  checkCodeRunRateLimit(userKey)

  const normalized = languageRaw.toLowerCase() as SupportedLanguage
  if (!(normalized in LANGUAGE_RUNTIME_MAP)) {
    throw new CodeRunnerError(`Unsupported language "${languageRaw}".`, 400)
  }

  if (code.length > 32_000) {
    throw new CodeRunnerError('Code size exceeds maximum 32KB limit.', 400)
  }

  const externalUrl = process.env.CODE_RUNNER_API_URL?.trim()
  if (externalUrl) {
    return runViaExternalApi(externalUrl, normalized, code)
  }

  if (process.env.CODE_RUNNER_DRIVER?.trim().toLowerCase() === 'docker') {
    return runViaDockerSandbox(normalized, code)
  }

  throw new CodeRunnerError(
    'Sandboxed code execution is not configured on this server. Set CODE_RUNNER_API_URL (e.g. a Piston-compatible sandbox endpoint) or CODE_RUNNER_DRIVER=docker in environment variables. Use Explain, Debug, or Optimize for AI analysis.',
    503
  )
}
