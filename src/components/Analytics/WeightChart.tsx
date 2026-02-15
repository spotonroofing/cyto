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

export function WeightChart() {
  const theme = useSettingsStore((s) => s.theme)
  const getRecentLogs = useDailyLogStore((s) => s.getRecentLogs)
  const isDark = theme === 'dark'

  const logs = getRecentLogs(90)
  const data = logs
    .filter((l) => l.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((log) => ({
      date: log.date.slice(5),
      weight: log.weight,
    }))

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Weight Trend</h3>

      {data.length === 0 ? (
        <p className="text-sm opacity-30 text-center py-8">No weight data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
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
              tick={{ fontSize: 10, fill: isDark ? '#FFFFFE80' : '#2D2A3280' }}
              axisLine={false}
              tickLine={false}
              width={35}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1a1a2e' : '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#B8F3D4"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
