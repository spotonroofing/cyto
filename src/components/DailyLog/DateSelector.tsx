import { useTheme } from '@/themes'

interface DateSelectorProps {
  date: string
  onChange: (date: string) => void
}

export function DateSelector({ date, onChange }: DateSelectorProps) {
  const { palette, isDark } = useTheme()
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
            ? 'bg-white/5'
            : 'bg-black/[0.03]'
        }`}
        style={{ color: palette.text, ['--tw-ring-color' as string]: palette.accent + '4D' }}
      />
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="text-xs px-3 py-1 rounded-full"
          style={{ backgroundColor: palette.accent + '33' }}
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
