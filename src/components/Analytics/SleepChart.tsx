import { useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useHealthDataStore } from '@/stores/healthDataStore'
import { useTheme } from '@/themes'

export function SleepChart() {
  const { palette, phaseColor } = useTheme()
  const { sleep, fetchSleepRange } = useHealthDataStore()

  // Fetch last 30 days of sleep data on mount
  useEffect(() => {
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    fetchSleepRange(start, end)
  }, [fetchSleepRange])

  const data = sleep
    .sort((a, b) => a.sleep_end.localeCompare(b.sleep_end))
    .map((session) => {
      const date = session.sleep_end.split('T')[0]
      const quality = session.total_sleep && session.duration_hours
        ? Math.round((session.total_sleep / session.duration_hours) * 100)
        : 0
      
      return {
        date: date.slice(5), // MM-DD
        duration: Number(session.duration_hours?.toFixed(1) ?? 0),
        quality,
      }
    })

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Sleep (30 Days)</h3>

      {data.length === 0 ? (
        <p className="text-sm opacity-30 text-center py-8">No sleep data yet</p>
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
              yAxisId="left"
              tick={{ fontSize: 10, fill: palette.textSecondary }}
              axisLine={false}
              tickLine={false}
              width={35}
              domain={[0, 12]}
              label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: palette.textSecondary } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: palette.textSecondary }}
              axisLine={false}
              tickLine={false}
              width={35}
              domain={[0, 100]}
              label={{ value: 'Quality %', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: palette.textSecondary } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: palette.surface,
                border: 'none',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="duration"
              name="Duration (hours)"
              stroke={phaseColor(5)}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="quality"
              name="Quality %"
              stroke={phaseColor(1)}
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
