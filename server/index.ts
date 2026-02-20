import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, 'data')
const STATE_FILE = resolve(DATA_DIR, 'state.json')
const DIST_DIR = resolve(__dirname, '..', 'dist')
const PORT = Number(process.env.PORT) || 3000

if (!process.env.PORT) {
  console.warn('No PORT env var — using default 3000')
}

interface AppState {
  updatedAt: string
  currentPhase: string
  overallProgress: { completed: number; total: number; percentage: number }
  milestones: Array<{
    id: string
    title: string
    phaseId: string
    status: string
    progress: { completed: number; total: number; percentage: number }
  }>
  recentLogs: Array<{
    date: string
    energy: number
    fog: number
    mood: number
    sleep: number
    flare: boolean
    foods: string[]
    notes: string
  }>
}

// Ensure data directory exists (Railway starts fresh each deploy)
try {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
} catch (err) {
  console.warn('Could not create data directory:', err)
}

// In-memory state
let currentState: AppState | null = null

// Load persisted state from file on startup
if (existsSync(STATE_FILE)) {
  try {
    const raw = readFileSync(STATE_FILE, 'utf-8')
    currentState = JSON.parse(raw) as AppState
    console.log(`Loaded state from ${STATE_FILE} (updated: ${currentState.updatedAt})`)
  } catch {
    console.warn('Failed to parse state.json, starting fresh')
  }
}

const app = new Hono()

// CORS for dev (Vite dev server runs on a different port)
app.use('/api/*', cors())

// Health check — Railway uses this to confirm the app is alive
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// GET /api/state — OpenClaw reads this
app.get('/api/state', (c) => {
  if (!currentState) {
    return c.json({ error: 'No state available yet' }, 404)
  }
  return c.json(currentState)
})

// POST /api/state — Client pushes state here
app.post('/api/state', async (c) => {
  try {
    const body = await c.req.json<AppState>()
    body.updatedAt = new Date().toISOString()
    currentState = body

    // Persist to file backup (ephemeral on Railway — lost on redeploy)
    try {
      writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2))
    } catch (err) {
      console.warn('Failed to write state.json:', err)
    }

    return c.json({ ok: true, updatedAt: currentState.updatedAt })
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
})

// GET /api/health — Kept for backward compat
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', hasState: currentState !== null })
})

// Serve static files from Vite build output
app.use('/*', serveStatic({ root: './dist' }))

// SPA fallback — serve index.html for all non-API, non-static routes
app.get('*', (c) => {
  try {
    const indexPath = resolve(DIST_DIR, 'index.html')
    const html = readFileSync(indexPath, 'utf-8')
    return c.html(html)
  } catch {
    return c.text('Build not found. Run npm run build first.', 404)
  }
})

console.log(`cyto server starting on port ${PORT}`)
serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' })
console.log(`cyto server running on 0.0.0.0:${PORT}`)
