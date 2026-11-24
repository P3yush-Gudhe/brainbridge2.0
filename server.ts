import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import express from 'express'
import type { Request, Response } from 'express'

import { aiRouter } from './server/aiRoutes.ts'
import { dbRouter } from './server/dbRoutes.ts'
import { requireAuth } from './src/middleware/auth.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const port = Number(process.env.PORT) || 3000

  app.use(express.json({ limit: '25mb' }))

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/ai', requireAuth, aiRouter)
  app.use('/api', dbRouter)

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

  app.listen(port, '0.0.0.0', () => {
    console.log(`StudyMate server listening on http://0.0.0.0:${port}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
