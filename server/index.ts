import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql, initDb } from './db.ts'

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

// --- Auth middleware for new health data endpoints (not GET /api/health) ---
app.use('/api/health/*', async (c, next) => {
  const key = c.req.header('x-api-key')
  if (!process.env.CYTO_API_KEY || key !== process.env.CYTO_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// --- Health data import ---
app.post('/api/health/import', async (c) => {
  try {
    const body = await c.req.json()
    const metrics = body?.data?.metrics
    if (!Array.isArray(metrics)) {
      return c.json({ error: 'Expected data.metrics array' }, 400)
    }

    const counts = { sleep: 0, nutrition: 0, weight: 0, other: 0 }

    const dietaryMap: Record<string, string> = {
      dietary_energy: 'calories',
      dietary_protein: 'protein_g',
      dietary_carbohydrates: 'carbs_g',
      dietary_fat_total: 'fat_g',
    }
    const nutritionByDate = new Map<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number; lastTime: string | null }>()

    for (const metric of metrics) {
      const name: string = metric.name
      const units: string = metric.units ?? ''
      const data: any[] = metric.data ?? []

      if (name === 'sleep_analysis') {
        for (const dp of data) {
          const sleepStart = dp.sleepStart ?? dp.sleep_start ?? null
          const sleepEnd = dp.sleepEnd ?? dp.sleep_end ?? null
          if (!sleepStart) continue
          const durationHours = sleepStart && sleepEnd
            ? (new Date(sleepEnd).getTime() - new Date(sleepStart).getTime()) / 3_600_000
            : null
          const totalSleep = dp.totalSleep ?? dp.asleep ?? dp.qty ?? null
          const deep = dp.deep ?? null
          const rem = dp.rem ?? null
          const core = dp.core ?? null
          const inBed = dp.inBed ?? dp.in_bed ?? null

          await sql`
            INSERT INTO sleep_sessions (sleep_start, sleep_end, duration_hours, total_sleep, deep, rem, core, in_bed)
            VALUES (${sleepStart}, ${sleepEnd}, ${durationHours}, ${totalSleep}, ${deep}, ${rem}, ${core}, ${inBed})
            ON CONFLICT (sleep_start) DO UPDATE SET
              sleep_end = EXCLUDED.sleep_end,
              duration_hours = EXCLUDED.duration_hours,
              total_sleep = EXCLUDED.total_sleep,
              deep = EXCLUDED.deep,
              rem = EXCLUDED.rem,
              core = EXCLUDED.core,
              in_bed = EXCLUDED.in_bed
          `
          counts.sleep++
        }
      } else if (name in dietaryMap) {
        const column = dietaryMap[name]!
        for (const dp of data) {
          const qty = dp.qty ?? 0
          const dateStr = dp.date ? new Date(dp.date).toISOString().substring(0, 10) : null
          if (!dateStr) continue
          const entry = nutritionByDate.get(dateStr) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, lastTime: null }
          ;(entry as any)[column] += qty
          if (!entry.lastTime || dp.date > entry.lastTime) entry.lastTime = dp.date
          nutritionByDate.set(dateStr, entry)
        }
      } else if (name === 'body_mass') {
        for (const dp of data) {
          let weightLbs = dp.qty ?? dp.value ?? null
          if (weightLbs == null) continue
          if (units === 'kg') weightLbs = weightLbs * 2.20462
          const date = dp.date ?? null
          if (!date) continue

          await sql`
            INSERT INTO weight_entries (date, weight_lbs)
            VALUES (${date}, ${weightLbs})
            ON CONFLICT (date) DO UPDATE SET
              weight_lbs = EXCLUDED.weight_lbs
          `
          counts.weight++
        }
      } else {
        for (const dp of data) {
          const date = dp.date ?? null
          if (!date) continue
          await sql`
            INSERT INTO health_metrics (metric_name, value, date)
            VALUES (${name}, ${JSON.stringify(dp)}, ${date})
            ON CONFLICT (metric_name, date) DO UPDATE SET
              value = EXCLUDED.value
          `
          counts.other++
        }
      }
    }

    // Upsert aggregated nutrition data
    for (const [dateStr, entry] of nutritionByDate) {
      await sql`
        INSERT INTO nutrition_daily (date, calories, protein_g, carbs_g, fat_g, last_entry_time)
        VALUES (${dateStr}, ${entry.calories}, ${entry.protein_g}, ${entry.carbs_g}, ${entry.fat_g}, ${entry.lastTime})
        ON CONFLICT (date) DO UPDATE SET
          calories = EXCLUDED.calories,
          protein_g = EXCLUDED.protein_g,
          carbs_g = EXCLUDED.carbs_g,
          fat_g = EXCLUDED.fat_g,
          last_entry_time = EXCLUDED.last_entry_time,
          updated_at = NOW()
      `
      counts.nutrition++
    }

    return c.json({ ok: true, imported: counts })
  } catch (err) {
    console.error('Import error:', err)
    return c.json({ error: 'Import failed', detail: String(err) }, 500)
  }
})

// --- GET /api/health/summary/today ---
app.get('/api/health/summary/today', async (c) => {
  const today = new Date().toISOString().substring(0, 10)

  const [sleepRows, nutritionRows, weightRows] = await Promise.all([
    sql`SELECT sleep_start, sleep_end, duration_hours, total_sleep, deep, rem, core
        FROM sleep_sessions
        WHERE sleep_end::date = ${today}
        ORDER BY sleep_end DESC LIMIT 1`,
    sql`SELECT calories, protein_g, carbs_g, fat_g, last_entry_time
        FROM nutrition_daily WHERE date = ${today} LIMIT 1`,
    sql`SELECT weight_lbs FROM weight_entries
        WHERE date::date = ${today} ORDER BY date DESC LIMIT 1`,
  ])

  return c.json({
    date: today,
    sleep: sleepRows[0] ?? null,
    nutrition: nutritionRows[0] ?? null,
    weight_lbs: weightRows[0]?.weight_lbs ?? null,
    last_sync: new Date().toISOString(),
  })
})

// --- GET /api/health/sleep/latest ---
app.get('/api/health/sleep/latest', async (c) => {
  const rows = await sql`
    SELECT * FROM sleep_sessions ORDER BY sleep_end DESC LIMIT 1
  `
  return c.json(rows[0] ?? null)
})

// --- GET /api/health/nutrition/today ---
app.get('/api/health/nutrition/today', async (c) => {
  const today = new Date().toISOString().substring(0, 10)
  const rows = await sql`
    SELECT * FROM nutrition_daily WHERE date = ${today} LIMIT 1
  `
  return c.json(rows[0] ?? null)
})

// --- Debug endpoints ---
app.get('/api/health/debug/recent', async (c) => {
  const rows = await sql`
    SELECT * FROM health_metrics ORDER BY date DESC LIMIT 50
  `
  return c.json(rows)
})

app.get('/api/health/debug/tables', async (c) => {
  const [hm, ss, nd, we] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM health_metrics`,
    sql`SELECT COUNT(*)::int AS count FROM sleep_sessions`,
    sql`SELECT COUNT(*)::int AS count FROM nutrition_daily`,
    sql`SELECT COUNT(*)::int AS count FROM weight_entries`,
  ])
  return c.json({
    health_metrics: hm[0].count,
    sleep_sessions: ss[0].count,
    nutrition_daily: nd[0].count,
    weight_entries: we[0].count,
  })
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

async function main() {
  try {
    await initDb()
  } catch (err) {
    console.error('Database init failed:', err)
  }

  console.log(`cyto server starting on port ${PORT}`)
  serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' })
  console.log(`cyto server running on 0.0.0.0:${PORT}`)
}

main()
