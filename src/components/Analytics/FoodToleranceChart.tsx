import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { actionItems } from '@/data/roadmap'

// Baseline: ~50 common foods per spec
const TOTAL_FOODS = 50

export function FoodToleranceChart() {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const getActionItem = useRoadmapStore((s) => s.getActionItem)

  // Get all food trial items
  const foodItems = actionItems.filter((a) => a.foodTrial)
  const completedFoods = foodItems
    .map((a) => getActionItem(a.id))
    .filter((a) => a.completed && a.foodTrial)
    .sort((a, b) => (a.completedDate ?? '').localeCompare(b.completedDate ?? ''))

  // Build cumulative chart data
  let passCount = 0
  const data: { date: string; percentage: number; failed?: boolean }[] = []
  const failDots: { date: string; percentage: number }[] = []

  for (const food of completedFoods) {
    const date = food.completedDate ?? 'unknown'
    if (food.foodTrial?.outcome === 'pass') {
      passCount++
    }
    const percentage = Math.round((passCount / TOTAL_FOODS) * 100)
    data.push({ date: date.slice(5), percentage })
    if (food.foodTrial?.outcome === 'fail') {
      failDots.push({ date: date.slice(5), percentage })
    }
  }

  const currentPercentage = Math.round((passCount / TOTAL_FOODS) * 100)

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-1">Food Tolerance</h3>
      <p className="text-xs opacity-40 mb-3">
        {currentPercentage}% of dietary freedom ({passCount}/{TOTAL_FOODS} foods)
      </p>

      {data.length === 0 ? (
        <p className="text-sm opacity-30 text-center py-8">
          No food trials completed yet
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: isDark ? '#FFFFFE80' : '#2D2A3280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: isDark ? '#FFFFFE80' : '#2D2A3280' }}
              axisLine={false}
              tickLine={false}
              width={30}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1a1a2e' : '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value}%`, 'Tolerance']}
            />
            <Line
              type="monotone"
              dataKey="percentage"
              stroke="#FFF3B0"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            {/* Red dots for failed foods */}
            {failDots.map((dot, i) => (
              <ReferenceDot
                key={i}
                x={dot.date}
                y={dot.percentage}
                r={5}
                fill="#FF4444"
                stroke="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
