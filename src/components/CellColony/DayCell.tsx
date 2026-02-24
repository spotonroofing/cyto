import type { DailyLog } from '@/types'

// Organelle colors
const ENERGY_COLOR = '#F5A623'
const MOOD_COLOR = '#7ED688'
const FOG_COLOR = '#6CB4EE'
const SLEEP_COLOR = '#B39DDB'

// Generate a stable organic border-radius from day index
function organicRadius(dayIndex: number): string {
  const seed = dayIndex * 7 + 3
  const a = 45 + (seed % 15)
  const b = 42 + ((seed * 3) % 16)
  const c = 48 + ((seed * 7) % 14)
  const d = 44 + ((seed * 11) % 13)
  return `${a}% ${100 - a}% ${b}% ${100 - b}% / ${c}% ${d}% ${100 - d}% ${100 - c}%`
}

interface DayCellProps {
  dayIndex: number
  date: string
  log: DailyLog | undefined
  phaseColor: string
  isToday: boolean
  isSelected: boolean
  onClick: () => void
}

export function DayCell({
  dayIndex,
  date,
  log,
  phaseColor,
  isToday,
  isSelected,
  onClick,
}: DayCellProps) {
  const isLogged = !!log
  const radius = organicRadius(dayIndex)

  // EXPANDED selected cell — rendered differently
  if (isSelected) {
    return (
      <div
        className="flex-shrink-0 cursor-pointer"
        style={{ width: '100%', height: 100, padding: '0 6px' }}
        onClick={onClick}
      >
        <ExpandedCell
          date={date}
          log={log}
          phaseColor={phaseColor}
          isToday={isToday}
          dayIndex={dayIndex}
        />
      </div>
    )
  }

  // COLLAPSED — logged day
  if (isLogged) {
    return (
      <div
        className="flex-shrink-0 cursor-pointer flex items-center justify-center"
        style={{ width: '100%', height: 36 }}
        onClick={onClick}
      >
        <div
          className="relative"
          style={{
            width: 32,
            height: 30,
            borderRadius: radius,
            backgroundColor: phaseColor,
            opacity: 0.8,
          }}
        >
          {/* Organelle dots: 2x2 grid */}
          <OrganelleDots log={log} />
          {/* Flare indicator */}
          {log.flare && (
            <div
              className="absolute"
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: '#FF6B4A',
                bottom: 2,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          )}
        </div>
      </div>
    )
  }

  // COLLAPSED — unlogged today (breathing)
  if (isToday) {
    return (
      <div
        className="flex-shrink-0 cursor-pointer flex items-center justify-center"
        style={{ width: '100%', height: 36 }}
        onClick={onClick}
      >
        <div
          className="colony-today-breathe"
          style={{
            width: 32,
            height: 30,
            borderRadius: radius,
            border: `1.5px solid ${phaseColor}`,
            opacity: 0.6,
          }}
        />
      </div>
    )
  }

  // COLLAPSED — unlogged past day
  return (
    <div
      className="flex-shrink-0 cursor-pointer flex items-center justify-center"
      style={{ width: '100%', height: 36 }}
      onClick={onClick}
    >
      <div
        style={{
          width: 28,
          height: 26,
          borderRadius: radius,
          border: `1px solid ${phaseColor}`,
          opacity: 0.2,
        }}
      />
    </div>
  )
}

function OrganelleDots({ log }: { log: DailyLog }) {
  const dots = [
    { color: ENERGY_COLOR, value: log.energy },
    { color: MOOD_COLOR, value: log.mood },
    { color: FOG_COLOR, value: log.fog },
    { color: SLEEP_COLOR, value: log.sleep },
  ]

  return (
    <div
      className="absolute"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'grid',
        gridTemplateColumns: '4px 4px',
        gap: 3,
      }}
    >
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: d.color,
            opacity: d.value / 10,
          }}
        />
      ))}
    </div>
  )
}

function formatDate(dateStr: string, isToday: boolean): string {
  if (isToday) return 'Today'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ExpandedCell({
  date,
  log,
  phaseColor,
  isToday,
}: {
  date: string
  log: DailyLog | undefined
  phaseColor: string
  isToday: boolean
  dayIndex: number
}) {
  const label = formatDate(date, isToday)

  if (!log) {
    // Unlogged expanded
    return (
      <div
        className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-1"
        style={{
          border: `1px solid ${phaseColor}`,
          opacity: 0.6,
        }}
      >
        <span style={{ fontSize: 11, color: phaseColor }}>{label}</span>
        <span style={{ fontSize: 10, color: phaseColor, opacity: 0.7 }}>+ Log this day</span>
      </div>
    )
  }

  const metrics = [
    { key: 'E', value: log.energy, color: '#F5A623' },
    { key: 'M', value: log.mood, color: '#7ED688' },
    { key: 'F', value: log.fog, color: '#6CB4EE' },
    { key: 'S', value: log.sleep, color: '#B39DDB' },
  ]

  return (
    <div
      className="w-full h-full rounded-xl p-2.5 flex flex-col gap-1"
      style={{ backgroundColor: phaseColor + '20' }}
    >
      <span style={{ fontSize: 11, color: phaseColor, fontWeight: 600 }}>{label}</span>
      <div className="flex flex-col gap-1 flex-1 justify-center">
        {metrics.map((m) => (
          <div key={m.key} className="flex items-center gap-1.5">
            <span style={{ fontSize: 9, width: 8, color: m.color, opacity: 0.8 }}>{m.key}</span>
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 4, backgroundColor: m.color + '20' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(m.value / 10) * 100}%`,
                  backgroundColor: m.color,
                  transition: 'width 200ms ease-out',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {log.flare && (
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 9, color: '#FF6B4A', fontWeight: 600 }}>FLARE</span>
          {log.flareSeverity && (
            <span style={{ fontSize: 9, color: '#FF6B4A', opacity: 0.7 }}>{log.flareSeverity}</span>
          )}
        </div>
      )}
    </div>
  )
}
