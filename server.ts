import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import express from 'express'
import type { Request, Response } from 'express'

import { closePool } from './src/db/index.ts'
import { centralErrorHandler, createApiApp } from './server/app.ts'
import { validateGeminiConfig } from './server/gemini.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = createApiApp({ attachErrorHandler: false })
  const port = Number(process.env.PORT) || 3000

  void validateGeminiConfig()

  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) {
    const frontendRequire = createRequire(path.resolve(__dirname, 'frontend', 'package.json'))
    const viteEntry = frontendRequire.resolve('vite')
    const { createServer: createViteServer } = await import(pathToFileURL(viteEntry).href)
    const vite = await createViteServer({
      root: path.resolve(__dirname, 'frontend'),
      configFile: path.resolve(__dirname, 'frontend', 'vite.config.ts'),
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distDir = path.resolve(__dirname, 'frontend', 'dist')
    app.use(express.static(distDir))
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.use(centralErrorHandler)

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`StudyMate server listening on http://0.0.0.0:${port}`)
  })

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\nReceived ${signal}. Shutting down gracefully...`)

    const forceTimer = setTimeout(() => {
      console.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
    forceTimer.unref()

    server.close(async () => {
      try {
        await closePool()
        console.log('Database pool closed cleanly. Goodbye.')
        process.exit(0)
      } catch (err) {
        console.error('Error closing database pool:', err)
        process.exit(1)
      }
    })
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
