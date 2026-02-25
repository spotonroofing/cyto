import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { phases } from '@/data/roadmap'
import { useTheme } from '@/themes'
import type { DailyLog } from '@/types'

const DOT_SPACING = 18
const COLLAPSED_WIDTH = 28
const EXPANDED_WIDTH_MOBILE = 180
const EXPANDED_WIDTH_DESKTOP = 200
const PADDING_TOP = 60
const PADDING_BOTTOM = 70
const LINE_X = 14 // center of 28px strip
const CURVE_RADIUS = 20
const DOT_R = 4 // dot radius (8px diameter)
const HALO_R = 6 // halo radius (12px diameter)

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

function getPhaseIndex(dayOffset: number): number {
  for (let i = phases.length - 1; i >= 0; i--) {
    if (dayOffset >= phases[i]!.defaultStartOffset) return i
  }
  return 0
}

function getPhaseColorFromPalette(
  dayOffset: number,
  phaseColors: string[],
): string {
  const idx = getPhaseIndex(dayOffset)
  return phaseColors[idx] ?? phaseColors[0]!
}

function isLogged(log: DailyLog | undefined): boolean {
  if (!log) return false
  return (
    log.energy > 0 ||
    log.mood > 0 ||
    log.fog > 0 ||
    log.sleep > 0 ||
    log.flare === true ||
    log.foods.length > 0
  )
}

function buildDateList(protocolStart: string): string[] {
  const today = todayString()
  const start = new Date(protocolStart + 'T00:00:00')
  const end = new Date(today + 'T00:00:00')
  if (start > end) return [today]

  const dates: string[] = []
  const cursor = new Date(end)
  while (cursor >= start) {
    dates.push(cursor.toISOString().split('T')[0]!)
    cursor.setDate(cursor.getDate() - 1)
  }
  return dates // newest first
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isYesterday(dateStr: string): boolean {
  const today = new Date(todayString() + 'T00:00:00')
  const d = new Date(dateStr + 'T00:00:00')
  const diff = today.getTime() - d.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24)) === 1
}

// ---------- Progress Ring ----------

const RING_SIZE = 32
const RING_STROKE = 3
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_CIRC = 2 * Math.PI * RING_R

const METRIC_COLORS: Record<string, string> = {
  E: '#F5A623',
  M: '#7ED688',
  F: '#6CB4EE',
  S: '#B39DDB',
}

function ProgressRing({
  letter,
  value,
  max = 10,
  phaseColor,
}: {
  letter: string
  value: number
  max?: number
  phaseColor: string
}) {
  const fraction = Math.min(value / max, 1)
  const offset = RING_CIRC * (1 - fraction)
  const color = METRIC_COLORS[letter] ?? phaseColor

  return (
    <svg width={RING_SIZE} height={RING_SIZE} style={{ display: 'block' }}>
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        fill="none"
        stroke={phaseColor}
        strokeOpacity={0.12}
        strokeWidth={RING_STROKE}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth={RING_STROKE}
        strokeDasharray={RING_CIRC}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
      <text
        x={RING_SIZE / 2}
        y={RING_SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.7)"
        fontSize={9}
        fontFamily="'JetBrains Mono', monospace"
      >
        {letter}
      </text>
    </svg>
  )
}

// ---------- Main Component ----------

export function CellColonyStrip() {
  const protocolStartDate = useSettingsStore((s) => s.protocolStartDate)
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const logs = useDailyLogStore((s) => s.logs)
  const openLogForDate = useUIStore((s) => s.openLogForDate)
  const { phaseColor: themePhaseColor } = useTheme()

  const [expanded, setExpanded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = todayString()

  const phaseColors = useMemo(
    () => Array.from({ length: 8 }, (_, i) => themePhaseColor(i)),
    [themePhaseColor],
  )

  const dates = useMemo(
    () => (protocolStartDate ? buildDateList(protocolStartDate) : [today]),
    [protocolStartDate, today],
  )

  const startDate = useMemo(
    () => new Date((protocolStartDate || today) + 'T00:00:00'),
    [protocolStartDate, today],
  )

  const getDayOffset = useCallback(
    (date: string) => {
      const d = new Date(date + 'T00:00:00')
      return Math.round(
        (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    },
    [startDate],
  )

  const colorForDate = useCallback(
    (date: string) => {
      const offset = getDayOffset(date)
      return getPhaseColorFromPalette(Math.max(0, offset), phaseColors)
    },
    [getDayOffset, phaseColors],
  )

  // Running day counter: date -> logged day number (oldest first count)
  const dayCounterMap = useMemo(() => {
    const map = new Map<string, number>()
    let counter = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      const date = dates[i]!
      if (isLogged(getLogForDate(date))) {
        counter++
        map.set(date, counter)
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, logs])

  // Most recent logged day
  const latestLoggedDate = useMemo(() => {
    for (const date of dates) {
      if (dayCounterMap.has(date)) return date
    }
    return null
  }, [dates, dayCounterMap])

  const expandedWidth =
    typeof window !== 'undefined' && window.innerWidth < 768
      ? EXPANDED_WIDTH_MOBILE
      : EXPANDED_WIDTH_DESKTOP

  // Click/touch outside to collapse
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setSelectedDate(null)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [expanded])

  const handleDotClick = useCallback(
    (date: string) => {
      if (!expanded) {
        setExpanded(true)
        setSelectedDate(date)
      } else if (selectedDate === date) {
        setExpanded(false)
        setSelectedDate(null)
      } else {
        setSelectedDate(date)
      }
    },
    [expanded, selectedDate],
  )

  const handleCardClick = useCallback(
    (date: string) => {
      openLogForDate(date)
      setExpanded(false)
      setSelectedDate(null)
    },
    [openLogForDate],
  )

  const currentPhaseColor = colorForDate(today)
  const noStartDate = !protocolStartDate

  const contentHeight = dates.length * DOT_SPACING
  const dotY = (i: number) => i * DOT_SPACING + DOT_SPACING / 2

  // SVG gradient stops for line
  const gradientStops = useMemo(() => {
    if (dates.length <= 1) {
      return [
        { offset: '0%', color: currentPhaseColor },
        { offset: '100%', color: currentPhaseColor },
      ]
    }
    const stops: { offset: string; color: string }[] = []
    let prevColor = ''
    for (let i = 0; i < dates.length; i++) {
      const color = colorForDate(dates[i]!)
      const pct = (dotY(i) / contentHeight) * 100
      if (color !== prevColor) {
        if (prevColor) stops.push({ offset: `${pct.toFixed(1)}%`, color: prevColor })
        stops.push({ offset: `${pct.toFixed(1)}%`, color })
        prevColor = color
      }
    }
    if (prevColor) stops.push({ offset: '100%', color: prevColor })
    return stops
  }, [dates, colorForDate, currentPhaseColor, contentHeight])

  // Dot positions for SVG mask cutouts
  const dotPositions = useMemo(() => {
    const positions: { y: number }[] = []
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i]!
      const log = getLogForDate(date)
      const logged = isLogged(log)
      if (logged || date === today) {
        positions.push({ y: dotY(i) })
      }
    }
    return positions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, logs, today])

  return (
    <div
      ref={stripRef}
      className="fixed left-0 top-0 h-dvh z-10"
      style={{
        width: expanded ? expandedWidth : COLLAPSED_WIDTH,
        transition: 'width 200ms ease-out',
        touchAction: 'pan-y',
      }}
    >
      {/* Fixed top curve */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={COLLAPSED_WIDTH}
        height={PADDING_TOP + CURVE_RADIUS}
        style={{ zIndex: 3 }}
      >
        <path
          d={`M 0,${PADDING_TOP} A ${CURVE_RADIUS},${CURVE_RADIUS} 0 0,1 ${LINE_X},${PADDING_TOP + CURVE_RADIUS}`}
          fill="none"
          stroke={gradientStops[0]?.color ?? currentPhaseColor}
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      </svg>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto ticker-scroll"
        style={{
          paddingTop: PADDING_TOP + CURVE_RADIUS,
          paddingBottom: PADDING_BOTTOM + CURVE_RADIUS,
          touchAction: 'pan-y',
        }}
      >
        {noStartDate ? (
          <NoStartDateMessage expanded={expanded} color={currentPhaseColor} />
        ) : (
          <div className="relative" style={{ height: contentHeight, width: '100%' }}>
            {/* SVG line + dots */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={expanded ? expandedWidth : COLLAPSED_WIDTH}
              height={contentHeight}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="colony-line-grad" x1="0" y1="0" x2="0" y2="1">
                  {gradientStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                <mask id="colony-line-mask">
                  <rect x="0" y="0" width={COLLAPSED_WIDTH} height={contentHeight} fill="white" />
                  {dotPositions.map((dp, i) => (
                    <circle key={i} cx={LINE_X} cy={dp.y} r={HALO_R + 1} fill="black" />
                  ))}
                </mask>
              </defs>

              {/* Vertical line with mask cutouts at dot positions */}
              <line
                x1={LINE_X}
                y1={0}
                x2={LINE_X}
                y2={contentHeight}
                stroke="url(#colony-line-grad)"
                strokeWidth={2}
                strokeOpacity={0.5}
                mask="url(#colony-line-mask)"
              />

              {/* Dots on top of line */}
              {dates.map((date, i) => {
                const log = getLogForDate(date)
                const logged = isLogged(log)
                const isTodayDate = date === today
                if (!logged && !isTodayDate) return null

                const cy = dotY(i)
                const color = colorForDate(date)
                const r = isTodayDate ? 5 : DOT_R

                return logged ? (
                  <circle key={date} cx={LINE_X} cy={cy} r={r} fill={color} />
                ) : (
                  <circle
                    key={date}
                    cx={LINE_X}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                    className="ticker-pulse"
                  />
                )
              })}

              {/* Day counter labels */}
              {dates.map((date, i) => {
                const count = dayCounterMap.get(date)
                if (count == null) return null
                const isLatest = date === latestLoggedDate
                if (count % 5 !== 0 && !isLatest) return null

                return (
                  <text
                    key={`cnt-${date}`}
                    x={LINE_X + 10}
                    y={dotY(i)}
                    fill={colorForDate(date)}
                    fillOpacity={0.5}
                    fontSize={9}
                    fontFamily="'JetBrains Mono', monospace"
                    style={{ fontFeatureSettings: '"tnum"' }}
                    dominantBaseline="central"
                  >
                    {count}
                  </text>
                )
              })}
            </svg>

            {/* Hit targets + detail cards (HTML layer) */}
            {dates.map((date, i) => {
              const isSelected = expanded && selectedDate === date
              return (
                <div
                  key={date}
                  className="absolute"
                  style={{
                    top: dotY(i) - DOT_SPACING / 2,
                    left: 0,
                    width: COLLAPSED_WIDTH,
                    height: DOT_SPACING,
                  }}
                >
                  <button
                    className="absolute inset-0 cursor-pointer"
                    style={{ background: 'transparent', border: 'none', padding: 0, zIndex: 2 }}
                    onClick={() => handleDotClick(date)}
                    aria-label={`${date === today ? 'Today' : date}${isLogged(getLogForDate(date)) ? ' (logged)' : ''}`}
                  />
                  {isSelected && (
                    <DetailCard
                      date={date}
                      log={getLogForDate(date)}
                      logged={isLogged(getLogForDate(date))}
                      isToday={date === today}
                      color={colorForDate(date)}
                      dayCount={dayCounterMap.get(date)}
                      onCardClick={handleCardClick}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fixed bottom curve */}
      <svg
        className="absolute bottom-0 left-0 pointer-events-none"
        width={COLLAPSED_WIDTH}
        height={PADDING_BOTTOM + CURVE_RADIUS}
        style={{ zIndex: 3 }}
      >
        <path
          d={`M ${LINE_X},${PADDING_BOTTOM - CURVE_RADIUS} A ${CURVE_RADIUS},${CURVE_RADIUS} 0 0,0 0,${PADDING_BOTTOM}`}
          fill="none"
          stroke={gradientStops[gradientStops.length - 1]?.color ?? currentPhaseColor}
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      </svg>
    </div>
  )
}

// ---------- No Start Date ----------

function NoStartDateMessage({
  expanded,
  color,
}: {
  expanded: boolean
  color: string
}) {
  return (
    <div
      className="flex items-center justify-center h-full px-2"
      style={{ fontSize: 10, color: color + '80', textAlign: 'center' }}
    >
      {expanded ? 'Set protocol start date in Settings' : ''}
    </div>
  )
}

// ---------- Detail Card ----------

interface DetailCardProps {
  date: string
  log: DailyLog | undefined
  logged: boolean
  isToday: boolean
  color: string
  dayCount: number | undefined
  onCardClick: (date: string) => void
}

function DetailCard({
  date,
  log,
  logged,
  isToday,
  color,
  dayCount,
  onCardClick,
}: DetailCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [shiftY, setShiftY] = useState(0)

  useEffect(() => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const viewH = window.innerHeight
    if (rect.bottom > viewH - 8) {
      setShiftY(viewH - 8 - rect.bottom)
    } else if (rect.top < 8) {
      setShiftY(8 - rect.top)
    } else {
      setShiftY(0)
    }
  }, [date])

  const dateLabel = isToday
    ? 'Today'
    : isYesterday(date)
      ? 'Yesterday'
      : formatDateLabel(date)

  const metrics =
    logged && log
      ? [
          { key: 'E', value: log.energy },
          { key: 'M', value: log.mood },
          { key: 'F', value: log.fog },
          { key: 'S', value: log.sleep },
        ]
      : null

  return (
    <div
      ref={cardRef}
      className="absolute z-[15]"
      style={{
        left: COLLAPSED_WIDTH + 4,
        top: -12 + shiftY,
        width:
          (typeof window !== 'undefined' && window.innerWidth < 768
            ? EXPANDED_WIDTH_MOBILE
            : EXPANDED_WIDTH_DESKTOP) -
          COLLAPSED_WIDTH -
          12,
        animation: 'ticker-card-appear 150ms ease-out forwards',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onCardClick(date)
      }}
    >
      <div
        className="cursor-pointer"
        style={{
          background: 'rgba(12, 8, 20, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${color}1F`,
          borderRadius: 14,
          padding: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {logged && metrics ? (
          <>
            {/* Top line: date + day counter */}
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: color + 'CC' }}>{dateLabel}</span>
              {dayCount != null && (
                <span
                  style={{
                    fontSize: 10,
                    color: color + '66',
                    fontFeatureSettings: '"tnum"',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Day {dayCount}
                </span>
              )}
            </div>

            {/* Progress rings row */}
            <div className="flex justify-between" style={{ gap: 4 }}>
              {metrics.map((m) => (
                <ProgressRing key={m.key} letter={m.key} value={m.value} phaseColor={color} />
              ))}
            </div>

            {/* Flare indicator */}
            {log!.flare && (
              <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#FF6B4A',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 9, color: '#FF6B4A' }}>
                  Flare{log!.flareSeverity ? ` ${log!.flareSeverity}` : ''}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: color + 'CC', marginBottom: 4 }}>
              {dateLabel}
            </div>
            <div
              style={{ fontSize: 11, color: color + '66' }}
              {...(isToday ? { className: 'ticker-pulse' } : {})}
            >
              Tap to log
            </div>
          </>
        )}
      </div>
    </div>
  )
}
