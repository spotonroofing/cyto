import { useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useHealthDataStore } from '@/stores/healthDataStore'
import { useTheme } from '@/themes'

export function WeightChart() {
  const { palette } = useTheme()
  const { weight, fetchWeightRange } = useHealthDataStore()

  // Fetch last 90 days of weight data on mount
  useEffect(() => {
    const end = new Date().toISOString().split('T')[0] ?? ''
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
    fetchWeightRange(start, end)
  }, [fetchWeightRange])

  const data = weight
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date.slice(5),
      weight: entry.weight_lbs,
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
              stroke={palette.border}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: palette.textSecondary }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: palette.textSecondary }}
              axisLine={false}
              tickLine={false}
              width={35}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: palette.surface,
                border: 'none',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke={palette.done}
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
