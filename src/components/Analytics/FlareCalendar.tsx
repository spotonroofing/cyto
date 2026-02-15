import { useState } from 'react'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function FlareCalendar() {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const logs = useDailyLogStore((s) => s.logs)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  // Build log lookup
  const logMap = new Map<string, { flare: boolean; severity?: number; trigger?: string }>()
  for (const log of logs) {
    logMap.set(log.date, { flare: log.flare, severity: log.flareSeverity, trigger: log.flareTrigger })
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthName = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const navigateMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setMonth(d.getMonth())
    setYear(d.getFullYear())
  }

  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null
  const selectedLog = selectedDateStr ? logMap.get(selectedDateStr) : null

  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Flare Calendar</h3>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigateMonth(-1)} className="px-3 py-1 rounded-full text-sm opacity-60 hover:opacity-100">
          ←
        </button>
        <span className="text-sm font-medium">{monthName}</span>
        <button onClick={() => navigateMonth(1)} className="px-3 py-1 rounded-full text-sm opacity-60 hover:opacity-100">
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-[10px] opacity-40 font-mono">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const log = logMap.get(dateStr)
          const hasFlare = log?.flare
          const severity = log?.severity ?? 0

          let bg: string
          if (hasFlare) {
            // Severity colors: 1=light orange, 5=deep red
            const opacity = 0.3 + (severity / 5) * 0.5
            bg = `rgba(255, ${100 - severity * 15}, ${80 - severity * 15}, ${opacity})`
          } else if (log) {
            bg = isDark ? 'rgba(91,191,138,0.2)' : 'rgba(184,243,212,0.4)'
          } else {
            bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
          }

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-mono transition-colors ${
                selectedDay === day ? 'ring-2 ring-gold/50 dark:ring-copper/50' : ''
              }`}
              style={{ backgroundColor: bg }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Selected day details */}
      {selectedLog && selectedLog.flare && (
        <div className={`mt-3 p-3 rounded-2xl text-sm ${isDark ? 'bg-white/5' : 'bg-black/[0.03]'}`}>
          <div className="font-medium text-red-400">
            Flare — Severity {selectedLog.severity ?? '?'}/5
          </div>
          {selectedLog.trigger && (
            <div className="text-xs opacity-60 mt-1">Trigger: {selectedLog.trigger}</div>
          )}
        </div>
      )}
    </div>
  )
}
