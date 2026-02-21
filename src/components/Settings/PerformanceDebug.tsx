import { useDebugStore, type ToggleKey, type SliderKey } from '@/stores/debugStore'
import { useTheme } from '@/themes'

const toggles: { key: ToggleKey; label: string }[] = [
  { key: 'gooFilter', label: 'Goo/membrane filter' },
  { key: 'gooWobble', label: 'Goo wobble animation' },
  { key: 'nucleusWobble', label: 'Nucleus wobble' },
  { key: 'particles', label: 'Particles' },
  { key: 'grid', label: 'Grid background' },
  { key: 'connectionGradients', label: 'Connection gradients' },
  { key: 'navButtonWobble', label: 'Nav button wobble' },
]

const sliders: { key: SliderKey; label: string; min: number; max: number; step: number; format: (v: number) => string }[] = [
  { key: 'particleCount', label: 'Particle count', min: 0, max: 2, step: 0.05, format: v => `${Math.round(v * 100)}%` },
  { key: 'particleOpacity', label: 'Particle opacity', min: 0, max: 1, step: 0.05, format: v => v.toFixed(2) },
  { key: 'gooWobbleIntensity', label: 'Goo wobble intensity', min: 0, max: 2, step: 0.05, format: v => `${Math.round(v * 100)}%` },
  { key: 'filterBlurRadius', label: 'SVG filter blur', min: 0, max: 2, step: 0.05, format: v => `${Math.round(v * 100)}%` },
]

const fpsOptions = [
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 0, label: 'Default' },
]

export function PerformanceDebug() {
  const { palette, isDark } = useTheme()
  const store = useDebugStore()

  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const inactiveBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  return (
    <div className="space-y-3">
      {/* Toggles */}
      {toggles.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-xs" style={{ color: palette.text }}>{label}</span>
          <button
            onClick={() => store.setToggle(key, !store[key])}
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ backgroundColor: store[key] ? palette.accent + '66' : inactiveBg }}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform shadow-sm ${
                store[key] ? 'translate-x-5' : 'translate-x-0.5'
              }`}
              style={{ backgroundColor: store[key] ? palette.accent : palette.surface }}
            />
          </button>
        </div>
      ))}

      {/* Sliders */}
      {sliders.map(({ key, label, min, max, step, format }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: palette.text }}>{label}</span>
            <span className="text-[10px] font-mono opacity-50">{format(store[key])}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={store[key]}
            onChange={(e) => store.setSlider(key, parseFloat(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${palette.accent} ${((store[key] - min) / (max - min)) * 100}%, ${trackBg} ${((store[key] - min) / (max - min)) * 100}%)`,
            }}
          />
        </div>
      ))}

      {/* FPS cap */}
      <div>
        <span className="text-xs block mb-1.5" style={{ color: palette.text }}>Frame rate cap</span>
        <div className="flex gap-1 flex-wrap">
          {fpsOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => store.setSlider('fpsCap', value)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors"
              style={{
                backgroundColor: store.fpsCap === value ? palette.accent + '33' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                color: store.fpsCap === value ? palette.accent : palette.text,
                fontWeight: store.fpsCap === value ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
