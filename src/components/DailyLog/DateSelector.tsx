import { useSettingsStore } from '@/stores/settingsStore'

interface DateSelectorProps {
  date: string
  onChange: (date: string) => void
}

export function DateSelector({ date, onChange }: DateSelectorProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const today = new Date().toISOString().split('T')[0]!
  const isToday = date === today

  return (
    <div className="flex items-center gap-3 mb-4">
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        className={`px-3 py-1.5 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
          isDark
            ? 'bg-white/5 focus:ring-copper/30 text-softwhite'
            : 'bg-black/[0.03] focus:ring-gold/30 text-charcoal'
        }`}
      />
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className={`text-xs px-3 py-1 rounded-full ${
            isDark ? 'bg-copper/20' : 'bg-gold/20'
          }`}
        >
          Today
        </button>
      )}
      {isToday && (
        <span className="text-xs opacity-40">Today</span>
      )}
    </div>
  )
}
