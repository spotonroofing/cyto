import { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useHealthDataStore } from '@/stores/healthDataStore'
import { useTheme } from '@/themes'

type MetricKey = 'energy' | 'fog' | 'mood' | 'sleep'

export function TrendChart() {
  const { palette, phaseColor } = useTheme()
  const getRecentLogs = useDailyLogStore((s) => s.getRecentLogs)
  const { sleep, fetchSleepRange } = useHealthDataStore()
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['energy', 'fog', 'mood', 'sleep']),
  )

  const metrics = useMemo(() => [
    { key: 'energy' as const, label: 'Energy', color: phaseColor(0) },
    { key: 'fog' as const, label: 'Brain Fog', color: phaseColor(2) },
    { key: 'mood' as const, label: 'Mood', color: phaseColor(1) },
    { key: 'sleep' as const, label: 'Sleep', color: phaseColor(5) },
  ], [phaseColor])

  // Fetch last 30 days of sleep data on mount
  useEffect(() => {
    const end = new Date().toISOString().split('T')[0] ?? ''
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
    fetchSleepRange(start, end)
  }, [fetchSleepRange])

  const logs = getRecentLogs(30)

  // Map sleep sessions to date -> duration_hours
  const sleepByDate = new Map<string, number>()
  for (const session of sleep) {
    const date = session.sleep_end.split('T')[0] ?? ''
    sleepByDate.set(date, session.duration_hours)
  }

  const data = logs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((log) => ({
      date: log.date.slice(5), // MM-DD
      energy: log.energy,
      fog: log.fog,
      mood: log.mood,
      sleep: sleepByDate.get(log.date) ?? log.sleep, // prefer server data, fallback to log
    }))

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">30-Day Trends</h3>

      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-opacity ${
              activeMetrics.has(m.key) ? 'opacity-100' : 'opacity-30'
            }`}
            style={{ backgroundColor: `${m.color}30`, color: m.color }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="text-sm opacity-30 text-center py-8">No data yet — start logging!</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={palette.border}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: palette.textSecondary }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[1, 10]}
              tick={{ fontSize: 10, fill: palette.textSecondary }}
              axisLine={false}
              tickLine={false}
              width={25}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: palette.surface,
                border: 'none',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            {metrics.map((m) =>
              activeMetrics.has(m.key) ? (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
