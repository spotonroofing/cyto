import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql, initDb } from './db.ts'

// --- Health metric routing maps ---
const WEIGHT_NAMES = new Set(['weight_body_mass', 'body_mass'])

const NUTRITION_MACRO_MAP: Record<string, string> = {
  protein: 'protein_g',
  dietary_protein: 'protein_g',
  total_fat: 'fat_g',
  dietary_fat_total: 'fat_g',
  dietary_sugar: 'sugar_g',
  dietary_energy: 'calories',
  dietary_carbohydrates: 'carbs_g',
}

const NUTRITION_MICRO_NAMES = new Set([
  'fiber', 'dietary_fiber', 'sodium', 'iron', 'calcium', 'potassium', 'zinc',
  'magnesium', 'vitamin_a', 'vitamin_b6', 'vitamin_b12', 'vitamin_c',
  'vitamin_d', 'vitamin_e', 'vitamin_k', 'folate', 'niacin', 'riboflavin',
  'thiamin', 'pantothenic_acid', 'dietary_cholesterol', 'saturated_fat',
  'monounsaturated_fat', 'polyunsaturated_fat', 'trans_fat', 'caffeine',
  'copper', 'manganese', 'selenium', 'chromium', 'biotin', 'dietary_water',
])

interface NutritionAgg {
  macros: Record<string, number>
  micronutrients: Record<string, number>
  lastTime: string | null
}

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

// --- Shared routing logic ---
async function processMetrics(metrics: Array<{ name: string; units?: string; data: any[] }>) {
  const counts = { sleep: 0, nutrition: 0, weight: 0, other: 0 }
  const nutritionByDate = new Map<string, NutritionAgg>()

  for (const metric of metrics) {
    const name = metric.name
    const units = metric.units ?? ''
    const data = metric.data ?? []

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
    } else if (WEIGHT_NAMES.has(name)) {
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
    } else if (name in NUTRITION_MACRO_MAP) {
      const column = NUTRITION_MACRO_MAP[name]!
      for (const dp of data) {
        const qty = dp.qty ?? 0
        const dateStr = dp.date ? new Date(dp.date).toISOString().substring(0, 10) : null
        if (!dateStr) continue
        const entry = nutritionByDate.get(dateStr) ?? { macros: {}, micronutrients: {}, lastTime: null }
        entry.macros[column] = (entry.macros[column] ?? 0) + qty
        if (!entry.lastTime || dp.date > entry.lastTime) entry.lastTime = dp.date
        nutritionByDate.set(dateStr, entry)
      }
    } else if (NUTRITION_MICRO_NAMES.has(name)) {
      for (const dp of data) {
        const qty = dp.qty ?? 0
        const dateStr = dp.date ? new Date(dp.date).toISOString().substring(0, 10) : null
        if (!dateStr) continue
        const entry = nutritionByDate.get(dateStr) ?? { macros: {}, micronutrients: {}, lastTime: null }
        entry.micronutrients[name] = (entry.micronutrients[name] ?? 0) + qty
        if (!entry.lastTime || dp.date > entry.lastTime) entry.lastTime = dp.date
        nutritionByDate.set(dateStr, entry)
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
    const proteinG = entry.macros.protein_g ?? null
    const fatG = entry.macros.fat_g ?? null
    const sugarG = entry.macros.sugar_g ?? null
    const carbsG = entry.macros.carbs_g ?? null
    const calories = entry.macros.calories ?? null
    const microJson = JSON.stringify(entry.micronutrients)

    await sql`
      INSERT INTO nutrition_daily (date, protein_g, fat_g, sugar_g, carbs_g, calories, micronutrients, last_entry_time, source)
      VALUES (${dateStr}, ${proteinG}, ${fatG}, ${sugarG}, ${carbsG}, ${calories}, ${microJson}, ${entry.lastTime}, 'apple_health')
      ON CONFLICT (date) DO UPDATE SET
        protein_g = COALESCE(EXCLUDED.protein_g, nutrition_daily.protein_g),
        fat_g = COALESCE(EXCLUDED.fat_g, nutrition_daily.fat_g),
        sugar_g = COALESCE(EXCLUDED.sugar_g, nutrition_daily.sugar_g),
        carbs_g = COALESCE(EXCLUDED.carbs_g, nutrition_daily.carbs_g),
        calories = COALESCE(EXCLUDED.calories, nutrition_daily.calories),
        micronutrients = COALESCE(nutrition_daily.micronutrients, '{}'::jsonb) || EXCLUDED.micronutrients,
        last_entry_time = COALESCE(EXCLUDED.last_entry_time, nutrition_daily.last_entry_time),
        updated_at = NOW()
    `
    counts.nutrition++
  }

  return counts
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

// GET /api/state — Return current roadmap state
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

    const counts = await processMetrics(metrics)
    return c.json({ ok: true, imported: counts })
  } catch (err) {
    console.error('Import error:', err)
    return c.json({ error: 'Import failed', detail: String(err) }, 500)
  }
})

// --- Backfill from health_metrics into structured tables ---
app.post('/api/health/backfill', async (c) => {
  try {
    const rows = await sql`SELECT * FROM health_metrics ORDER BY date`

    // Group rows by metric_name into the import format
    const byName = new Map<string, any[]>()
    for (const row of rows) {
      const name: string = row.metric_name
      const dp = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
      // Ensure data point has a date (fall back to row.date)
      if (!dp.date && row.date) dp.date = new Date(row.date).toISOString()
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name)!.push(dp)
    }

    const metrics = Array.from(byName.entries()).map(([name, data]) => ({ name, data }))
    const counts = await processMetrics(metrics)

    return c.json({ ok: true, total_health_metrics_rows: rows.length, routed: counts })
  } catch (err) {
    console.error('Backfill error:', err)
    return c.json({ error: 'Backfill failed', detail: String(err) }, 500)
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
    sql`SELECT calories, protein_g, carbs_g, fat_g, sugar_g, micronutrients, last_entry_time
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

// --- GET /api/health/sleep/range?start=YYYY-MM-DD&end=YYYY-MM-DD ---
app.get('/api/health/sleep/range', async (c) => {
  const end = c.req.query('end') ?? new Date().toISOString().substring(0, 10)
  const start = c.req.query('start') ?? new Date(Date.now() - 14 * 86_400_000).toISOString().substring(0, 10)
  const rows = await sql`
    SELECT * FROM sleep_sessions
    WHERE sleep_start::date >= ${start} AND sleep_start::date <= ${end}
    ORDER BY sleep_start DESC
  `
  return c.json({ start, end, count: rows.length, data: rows })
})

// --- GET /api/health/weight/range?start=YYYY-MM-DD&end=YYYY-MM-DD ---
app.get('/api/health/weight/range', async (c) => {
  const end = c.req.query('end') ?? new Date().toISOString().substring(0, 10)
  const start = c.req.query('start') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().substring(0, 10)
  const rows = await sql`
    SELECT * FROM weight_entries
    WHERE date::date >= ${start} AND date::date <= ${end}
    ORDER BY date DESC
  `
  return c.json({ start, end, count: rows.length, data: rows })
})

// --- GET /api/health/nutrition/range?start=YYYY-MM-DD&end=YYYY-MM-DD ---
app.get('/api/health/nutrition/range', async (c) => {
  const end = c.req.query('end') ?? new Date().toISOString().substring(0, 10)
  const start = c.req.query('start') ?? new Date(Date.now() - 14 * 86_400_000).toISOString().substring(0, 10)
  const rows = await sql`
    SELECT * FROM nutrition_daily
    WHERE date >= ${start} AND date <= ${end}
    ORDER BY date DESC
  `
  return c.json({ start, end, count: rows.length, data: rows })
})

// --- GET /api/health/summary/:date ---
app.get('/api/health/summary/:date', async (c) => {
  const date = c.req.param('date')

  const [sleepRows, nutritionRows, weightRows] = await Promise.all([
    sql`SELECT sleep_start, sleep_end, duration_hours, total_sleep, deep, rem, core
        FROM sleep_sessions
        WHERE sleep_end::date = ${date}
        ORDER BY sleep_end DESC LIMIT 1`,
    sql`SELECT calories, protein_g, carbs_g, fat_g, sugar_g, micronutrients, last_entry_time
        FROM nutrition_daily WHERE date = ${date} LIMIT 1`,
    sql`SELECT weight_lbs FROM weight_entries
        WHERE date::date = ${date} ORDER BY date DESC LIMIT 1`,
  ])

  return c.json({
    date,
    sleep: sleepRows[0] ?? null,
    nutrition: nutritionRows[0] ?? null,
    weight_lbs: weightRows[0]?.weight_lbs ?? null,
  })
})

// --- POST /api/logs — daily recovery log ---
app.post('/api/logs', async (c) => {
  try {
    const body = await c.req.json()
    const { date, energy, fog, mood, flare, foods, notes } = body

    if (!date) {
      return c.json({ error: 'date is required (YYYY-MM-DD)' }, 400)
    }

    // upsert logic: insert or update on conflict
    await sql`
      INSERT INTO daily_logs (date, energy, fog, mood, flare, foods, notes, updated_at)
      VALUES (${date}, ${energy}, ${fog}, ${mood}, ${flare ?? false}, ${JSON.stringify(foods ?? [])}, ${notes ?? ''}, NOW())
      ON CONFLICT (date) DO UPDATE SET
        energy = EXCLUDED.energy,
        fog = EXCLUDED.fog,
        mood = EXCLUDED.mood,
        flare = EXCLUDED.flare,
        foods = EXCLUDED.foods,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `

    return c.json({ ok: true, date })
  } catch (err) {
    console.error('POST /api/logs error:', err)
    return c.json({ error: 'Failed to save log', detail: String(err) }, 500)
  }
})

// --- GET /api/logs?start=YYYY-MM-DD&end=YYYY-MM-DD ---
app.get('/api/logs', async (c) => {
  try {
    const start = c.req.query('start')
    const end = c.req.query('end')

    let rows
    if (start && end) {
      rows = await sql`
        SELECT * FROM daily_logs
        WHERE date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `
    } else {
      // default: last 30 days
      rows = await sql`
        SELECT * FROM daily_logs
        ORDER BY date DESC
        LIMIT 30
      `
    }

    return c.json({ count: rows.length, data: rows })
  } catch (err) {
    console.error('GET /api/logs error:', err)
    return c.json({ error: 'Failed to fetch logs', detail: String(err) }, 500)
  }
})

// --- GET /api/settings ---
app.get('/api/settings', async (c) => {
  try {
    const rows = await sql`SELECT key, value FROM settings`
    const settings: Record<string, any> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return c.json(settings)
  } catch (err) {
    console.error('GET /api/settings error:', err)
    return c.json({ error: 'Failed to fetch settings', detail: String(err) }, 500)
  }
})

// --- PUT /api/settings ---
app.put('/api/settings', async (c) => {
  try {
    const body = await c.req.json()
    
    for (const [key, value] of Object.entries(body)) {
      await sql`
        INSERT INTO settings (key, value, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `
    }

    return c.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/settings error:', err)
    return c.json({ error: 'Failed to update settings', detail: String(err) }, 500)
  }
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
