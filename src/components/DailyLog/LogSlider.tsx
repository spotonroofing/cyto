import { useSettingsStore } from '@/stores/settingsStore'

interface LogSliderProps {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  color?: string
}

export function LogSlider({ label, value, min = 1, max = 10, onChange, color }: LogSliderProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const trackColor = color ?? (isDark ? '#C49A6C' : '#D4A574')

  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color: trackColor }}>
          {value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${percentage}%, ${
              isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
            } ${percentage}%, ${
              isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
            } 100%)`,
          }}
        />
      </div>
    </div>
  )
}
