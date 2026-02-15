import { useState } from 'react'
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
import { useSettingsStore } from '@/stores/settingsStore'

const metrics = [
  { key: 'energy', label: 'Energy', color: '#FFB5A7' },
  { key: 'fog', label: 'Brain Fog', color: '#D8BBFF' },
  { key: 'mood', label: 'Mood', color: '#FFAFCC' },
  { key: 'sleep', label: 'Sleep', color: '#A2D2FF' },
] as const

type MetricKey = (typeof metrics)[number]['key']

export function TrendChart() {
  const theme = useSettingsStore((s) => s.theme)
  const getRecentLogs = useDailyLogStore((s) => s.getRecentLogs)
  const isDark = theme === 'dark'
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['energy', 'fog', 'mood', 'sleep']),
  )

  const logs = getRecentLogs(30)
  const data = logs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((log) => ({
      date: log.date.slice(5), // MM-DD
      energy: log.energy,
      fog: log.fog,
      mood: log.mood,
      sleep: log.sleep,
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
              stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: isDark ? '#FFFFFE80' : '#2D2A3280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[1, 10]}
              tick={{ fontSize: 10, fill: isDark ? '#FFFFFE80' : '#2D2A3280' }}
              axisLine={false}
              tickLine={false}
              width={25}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1a1a2e' : '#fff',
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
