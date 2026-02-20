import { useTheme } from '@/themes'

interface LogSliderProps {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  color?: string
}

export function LogSlider({ label, value, min = 1, max = 10, onChange, color }: LogSliderProps) {
  const { palette } = useTheme()
  const trackColor = color ?? palette.accent

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
            background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${percentage}%, ${palette.border} ${percentage}%, ${palette.border} 100%)`,
          }}
        />
      </div>
    </div>
  )
}
