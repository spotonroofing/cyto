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

  console.log('Database tables initialized')
}
