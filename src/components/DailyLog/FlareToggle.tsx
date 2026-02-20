import { useTheme } from '@/themes'

interface FlareToggleProps {
  flare: boolean
  severity?: number
  trigger?: string
  onFlareChange: (flare: boolean) => void
  onSeverityChange: (severity: number) => void
  onTriggerChange: (trigger: string) => void
}

export function FlareToggle({
  flare,
  severity,
  trigger,
  onFlareChange,
  onSeverityChange,
  onTriggerChange,
}: FlareToggleProps) {
  const { palette, isDark } = useTheme()

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Flare today?</span>
        <button
          onClick={() => onFlareChange(!flare)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            flare
              ? 'bg-red-400/60'
              : isDark
                ? 'bg-white/10'
                : 'bg-black/10'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm ${
              flare ? 'translate-x-6 bg-red-400' : 'translate-x-0.5 bg-white'
            }`}
          />
        </button>
      </div>

      {flare && (
        <div className="pl-4 border-l-2 border-red-400/30 space-y-3 mt-3">
          {/* Severity */}
          <div>
            <span className="text-xs font-medium opacity-60 block mb-1">Severity (1-5)</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => onSeverityChange(n)}
                  className={`w-8 h-8 rounded-full text-xs font-mono font-bold transition-colors ${
                    severity === n
                      ? 'bg-red-400/40 text-red-700 dark:text-red-200'
                      : isDark
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Trigger note */}
          <div>
            <span className="text-xs font-medium opacity-60 block mb-1">Trigger (optional)</span>
            <input
              type="text"
              value={trigger ?? ''}
              onChange={(e) => onTriggerChange(e.target.value)}
              placeholder="What triggered it?"
              className={`w-full px-3 py-1.5 rounded-xl text-sm focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/5 placeholder:text-white/20'
                  : 'bg-black/[0.03] placeholder:text-black/20'
              }`}
              style={{ ['--tw-ring-color' as string]: palette.accent + '4D' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
