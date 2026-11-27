import cors from 'cors'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { aiRouter } from './aiRoutes.ts'
import { dbRouter } from './dbRoutes.ts'
import { uploadRouter } from './uploadRoutes.ts'
import { requireAuth } from '../src/middleware/auth.ts'

export class CorsNotAllowedError extends Error {
  status = 403
  constructor(origin: string) {
    super(`Origin "${origin}" is not permitted by CORS policy`)
    this.name = 'CorsNotAllowedError'
  }
}

export function getAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  if (configured.length > 0) {
    return configured
  }

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  const allowlist = getAllowedOrigins()
  if (allowlist.includes(origin)) return true

  // Allow Cloud Run / AI Studio preview origins in non-production unless explicit strict list is set
  const hasExplicitList = Boolean(process.env.CORS_ORIGIN?.trim())
  if (!hasExplicitList && process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin)
      if (parsed.hostname.endsWith('.run.app') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return true
      }
    } catch {
      return false
    }
  }
  return false
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now()
  res.on('finish', () => {
    if (!req.path.startsWith('/api')) return
    const durationMs = Date.now() - startedAt
    const sanitizedPath = req.originalUrl.split('?')[0]
    console.log(`[HTTP] ${req.method} ${sanitizedPath} ${res.statusCode} ${durationMs}ms`)
  })
  next()
}

export function centralErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (res.headersSent) return

  const typed = err as {
    status?: number
    statusCode?: number
    type?: string
    name?: string
    message?: string
  }

  if (typed?.type === 'entity.too.large' || typed?.status === 413 || typed?.statusCode === 413) {
    res.status(413).json({
      error: 'Request payload is too large. Upload PDFs or images via /api/uploads.',
    })
    return
  }

  if (typed?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    res.status(400).json({ error: 'Malformed JSON request body' })
    return
  }

  if (err instanceof CorsNotAllowedError) {
    res.status(403).json({ error: err.message })
    return
  }

  const status = typed?.status || typed?.statusCode || 500
  const isProd = process.env.NODE_ENV === 'production'
  console.error(`[API Error] ${req.method} ${req.path} -> ${status}:`, err)

  const message =
    status < 500
      ? typed?.message || 'Request error'
      : isProd
        ? 'Internal server error'
        : typed?.message || 'Internal server error'

  res.status(status).json({ error: message })
}

export function createApiApp(options?: { attachErrorHandler?: boolean; enableRateLimit?: boolean }) {
  const app = express()
  app.set('trust proxy', 1)

  // Security headers compatible with iframe preview & web workers (PDF.js / Monaco)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  )

  // Strict CORS allowlist
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true)
        } else {
          callback(new CorsNotAllowedError(origin || 'unknown'))
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )

  app.use(requestLoggerMiddleware)

  const enableRateLimit = options?.enableRateLimit !== false
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/api/health',
    message: { error: 'Too many API requests. Please wait a moment and try again.' },
  })

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 25,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'AI rate limit reached. Please wait a minute before sending more AI requests.' },
  })

  if (enableRateLimit) {
    app.use('/api', apiLimiter)
    app.use('/api/ai', aiLimiter)
    app.use('/api/uploads', aiLimiter)
  }

  // Dedicated high-limit JSON parser ONLY for binary PDF/image uploads
  app.use('/api/uploads', express.json({ limit: '25mb' }))
  // Strict 1MB JSON limit for all other routes
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/api/uploads', requireAuth, uploadRouter)
  app.use('/api/ai', requireAuth, aiRouter)
  app.use('/api', dbRouter)

  // JSON 404 for unmatched /api/* endpoints
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found' })
  })

  if (options?.attachErrorHandler !== false) {
    app.use(centralErrorHandler)
  }

  return app
}
