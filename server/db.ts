import postgres from 'postgres'

export const sql = postgres(process.env.DATABASE_URL!)

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS health_metrics (
      id SERIAL PRIMARY KEY,
      metric_name TEXT NOT NULL,
      value JSONB NOT NULL,
      date TIMESTAMPTZ NOT NULL,
      source TEXT DEFAULT 'apple_health',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(metric_name, date)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sleep_sessions (
      id SERIAL PRIMARY KEY,
      sleep_start TIMESTAMPTZ,
      sleep_end TIMESTAMPTZ,
      duration_hours NUMERIC,
      total_sleep NUMERIC,
      deep NUMERIC,
      rem NUMERIC,
      core NUMERIC,
      in_bed NUMERIC,
      source TEXT DEFAULT 'apple_health',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(sleep_start)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS nutrition_daily (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      calories NUMERIC DEFAULT 0,
      protein_g NUMERIC DEFAULT 0,
      carbs_g NUMERIC DEFAULT 0,
      fat_g NUMERIC DEFAULT 0,
      last_entry_time TIMESTAMPTZ,
      source TEXT DEFAULT 'chronometer',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date)
    )
  `

  // Add columns for HAE nutrient routing (idempotent)
  await sql`ALTER TABLE nutrition_daily ADD COLUMN IF NOT EXISTS sugar_g NUMERIC`
  await sql`ALTER TABLE nutrition_daily ADD COLUMN IF NOT EXISTS micronutrients JSONB DEFAULT '{}'`

  await sql`
    CREATE TABLE IF NOT EXISTS weight_entries (
      id SERIAL PRIMARY KEY,
      date TIMESTAMPTZ NOT NULL,
      weight_lbs NUMERIC NOT NULL,
      source TEXT DEFAULT 'apple_health',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      energy INTEGER CHECK (energy >= 1 AND energy <= 10),
      fog INTEGER CHECK (fog >= 1 AND fog <= 10),
      mood INTEGER CHECK (mood >= 1 AND mood <= 10),
      flare BOOLEAN DEFAULT FALSE,
      foods JSONB DEFAULT '[]',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Add sleep columns to daily_logs (idempotent)
  await sql`ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS sleep_start TIMESTAMPTZ`
  await sql`ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS sleep_end TIMESTAMPTZ`
  await sql`ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS sleep_duration_hours NUMERIC`
  await sql`ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS sleep_quality_pct NUMERIC`

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Seed default settings if empty
  const settingsCount = await sql`SELECT COUNT(*) as count FROM settings`
  if (Number(settingsCount[0]?.count) === 0) {
    await sql`
      INSERT INTO settings (key, value) VALUES
      ('protocolStartDate', '"2026-02-12"'),
      ('healthContext', 'null')
    `
  }

  console.log('Database tables initialized')
}
