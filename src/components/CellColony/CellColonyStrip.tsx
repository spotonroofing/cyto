import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { phases } from '@/data/roadmap'
import { useTheme } from '@/themes'
import type { DailyLog } from '@/types'

// ── Layout constants ──────────────────────────────────────────────────────
const COLLAPSED_WIDTH = 36
const EXPANDED_WIDTH_MOBILE = 220
const EXPANDED_WIDTH_DESKTOP = 240
const LINE_X = 18 // center of 36px strip
const CURVE_RADIUS = 18
const PADDING_TOP = 60
const PADDING_BOTTOM = 70
const ROW_HEIGHT = 40
const DOT_R = 4 // 8px diameter
const DOT_R_SELECTED = 6 // 12px diameter
const DOT_R_TODAY = 5 // 10px diameter
const HALO_R = 6 // 12px dark halo

// ── Progress ring constants ───────────────────────────────────────────────
const RING_SIZE = 40
const RING_STROKE = 3
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_CIRC = 2 * Math.PI * RING_R

const METRIC_COLORS: Record<string, string> = {
  E: '#F5A623',
  M: '#7ED688',
  F: '#6CB4EE',
  S: '#B39DDB',
}

// ── Helpers ───────────────────────────────────────────────────────────────

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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isYesterday(dateStr: string): boolean {
  const today = new Date(todayString() + 'T00:00:00')
  const d = new Date(dateStr + 'T00:00:00')
  const diff = today.getTime() - d.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24)) === 1
}

function getWeekdayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── ProgressRing ──────────────────────────────────────────────────────────

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
    <div style={{ textAlign: 'center' }}>
      <svg width={RING_SIZE} height={RING_SIZE} style={{ display: 'block', margin: '0 auto' }}>
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke={phaseColor}
          strokeOpacity={0.1}
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
          fill="rgba(255,255,255,0.6)"
          fontSize={10}
          fontFamily="'JetBrains Mono', monospace"
        >
          {letter}
        </text>
      </svg>
      <div
        style={{
          fontSize: 9,
          color,
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function CellColonyStrip() {
  const protocolStartDate = useSettingsStore((s) => s.protocolStartDate)
  const getLogForDate = useDailyLogStore((s) => s.getLogForDate)
  const logs = useDailyLogStore((s) => s.logs)
  const openLogForDate = useUIStore((s) => s.openLogForDate)
  const { phaseColor: themePhaseColor } = useTheme()

  const [shelfOpen, setShelfOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(todayString())
  const [contentKey, setContentKey] = useState(0) // for crossfade
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const swipeStartX = useRef<number | null>(null)

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

  // ── Scroll snap detection ───────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const containerRect = el.getBoundingClientRect()
        const centerY = containerRect.top + containerRect.height / 2

        // Find the row closest to the center
        const rows = el.querySelectorAll<HTMLElement>('[data-date]')
        let bestDate: string | null = null
        let bestDist = Infinity

        rows.forEach((row) => {
          const rowRect = row.getBoundingClientRect()
          const rowCenter = rowRect.top + rowRect.height / 2
          const dist = Math.abs(rowCenter - centerY)
          if (dist < bestDist) {
            bestDist = dist
            bestDate = row.dataset.date ?? null
          }
        })

        if (bestDate && bestDate !== selectedDate) {
          setSelectedDate(bestDate)
          setContentKey((k) => k + 1)
        }
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [selectedDate])

  // ── Click/touch outside to close shelf ──────────────────────────────────
  useEffect(() => {
    if (!shelfOpen) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setShelfOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [shelfOpen])

  // ── Swipe gestures on the strip ─────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0]!.clientX
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (swipeStartX.current === null) return
      const dx = e.changedTouches[0]!.clientX - swipeStartX.current
      swipeStartX.current = null

      if (dx > 40 && !shelfOpen) {
        setShelfOpen(true)
      } else if (dx < -40 && shelfOpen) {
        setShelfOpen(false)
      }
    },
    [shelfOpen],
  )

  // ── Dot tap handler ─────────────────────────────────────────────────────
  const handleDotClick = useCallback(
    (date: string) => {
      if (selectedDate === date && shelfOpen) {
        // Tap selected dot again => close shelf
        setShelfOpen(false)
      } else {
        setSelectedDate(date)
        setContentKey((k) => k + 1)
        setShelfOpen(true)
      }
    },
    [selectedDate, shelfOpen],
  )

  // ── Shelf content tap → open log panel ──────────────────────────────────
  const handleShelfContentClick = useCallback(
    (date: string) => {
      openLogForDate(date)
      setShelfOpen(false)
    },
    [openLogForDate],
  )

  const currentPhaseColor = colorForDate(today)
  const noStartDate = !protocolStartDate

  // ── Gradient stops for the vertical line ────────────────────────────────
  const contentHeight = dates.length * ROW_HEIGHT
  const dotY = (i: number) => i * ROW_HEIGHT + ROW_HEIGHT / 2

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

  // ── Dot mask positions (for line interruption) ──────────────────────────
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

  // ── Selected day data for shelf ─────────────────────────────────────────
  const selectedLog = getLogForDate(selectedDate)
  const selectedLogged = isLogged(selectedLog)
  const selectedColor = colorForDate(selectedDate)
  const selectedDayCount = dayCounterMap.get(selectedDate)

  return (
    <div
      ref={stripRef}
      className="fixed left-0 top-0 h-dvh"
      style={{
        width: shelfOpen ? expandedWidth : COLLAPSED_WIDTH,
        transition: 'width 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        zIndex: shelfOpen ? 12 : 10,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Shelf background (only visible when expanded) ───────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: shelfOpen ? 'rgba(10, 8, 18, 0.9)' : 'transparent',
          backdropFilter: shelfOpen ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: shelfOpen ? 'blur(14px)' : 'none',
          borderRight: shelfOpen ? `1px solid ${selectedColor}1A` : 'none',
          borderRadius: shelfOpen ? '0 16px 16px 0' : '0',
          transition: 'background 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94), border-radius 250ms',
        }}
      />

      {/* ── Fixed top curve ─────────────────────────────────────────── */}
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

      {/* ── Scrollable snap area ────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto ticker-scroll"
        style={{
          paddingTop: PADDING_TOP + CURVE_RADIUS,
          paddingBottom: PADDING_BOTTOM + CURVE_RADIUS,
          touchAction: 'pan-y',
          scrollSnapType: 'y mandatory',
        }}
      >
        {noStartDate ? (
          <div
            className="flex items-center justify-center h-full px-2"
            style={{
              fontSize: 10,
              color: currentPhaseColor + '80',
              textAlign: 'center',
            }}
          >
            {shelfOpen ? 'Set protocol start date in Settings' : ''}
          </div>
        ) : (
          <div className="relative" style={{ height: contentHeight, width: '100%' }}>
            {/* ── SVG line + dots layer ─────────────────────────────── */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={COLLAPSED_WIDTH}
              height={contentHeight}
              style={{ overflow: 'visible', zIndex: 1 }}
            >
              <defs>
                <linearGradient id="colony-line-grad-v3" x1="0" y1="0" x2="0" y2="1">
                  {gradientStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                <mask id="colony-line-mask-v3">
                  <rect x="0" y="0" width={COLLAPSED_WIDTH} height={contentHeight} fill="white" />
                  {dotPositions.map((dp, i) => (
                    <circle key={i} cx={LINE_X} cy={dp.y} r={HALO_R + 1} fill="black" />
                  ))}
                </mask>
              </defs>

              {/* Vertical line with mask cutouts */}
              <line
                x1={LINE_X}
                y1={0}
                x2={LINE_X}
                y2={contentHeight}
                stroke="url(#colony-line-grad-v3)"
                strokeWidth={2}
                strokeOpacity={0.5}
                mask="url(#colony-line-mask-v3)"
              />

              {/* Dots */}
              {dates.map((date, i) => {
                const log = getLogForDate(date)
                const logged = isLogged(log)
                const isTodayDate = date === today
                if (!logged && !isTodayDate) return null

                const cy = dotY(i)
                const color = colorForDate(date)
                const isSelected = date === selectedDate

                if (logged) {
                  const r = isSelected ? DOT_R_SELECTED : DOT_R
                  return (
                    <circle
                      key={date}
                      cx={LINE_X}
                      cy={cy}
                      r={r}
                      fill={color}
                      style={{
                        transition: 'r 100ms ease-out',
                        filter: isSelected
                          ? `drop-shadow(0 0 8px ${color}80)`
                          : 'none',
                      }}
                    />
                  )
                }

                // Today unlogged: hollow pulse
                const r = isSelected ? DOT_R_SELECTED : DOT_R_TODAY
                return (
                  <circle
                    key={date}
                    cx={LINE_X}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                    className="ticker-today-pulse"
                    style={{
                      transition: 'r 100ms ease-out',
                      filter: isSelected
                        ? `drop-shadow(0 0 8px ${color}80)`
                        : 'none',
                    }}
                  />
                )
              })}

              {/* Day counter labels */}
              {dates.map((date, i) => {
                const count = dayCounterMap.get(date)
                if (count == null) return null

                const isSelected = date === selectedDate
                const isLatest = date === latestLoggedDate
                const showCount = count % 5 === 0 || isLatest || isSelected

                if (!showCount) return null

                const color = colorForDate(date)

                return (
                  <g key={`cnt-${date}`}>
                    <text
                      x={LINE_X + 12}
                      y={isSelected ? dotY(i) - 4 : dotY(i)}
                      fill={color}
                      fillOpacity={isSelected ? 0.7 : 0.4}
                      fontSize={9}
                      fontFamily="'JetBrains Mono', monospace"
                      style={{ fontFeatureSettings: '"tnum"' }}
                      dominantBaseline="central"
                    >
                      {count}
                    </text>
                    {isSelected && (
                      <text
                        x={LINE_X + 12}
                        y={dotY(i) + 7}
                        fill={color}
                        fillOpacity={0.3}
                        fontSize={8}
                        fontFamily="'JetBrains Mono', monospace"
                        dominantBaseline="central"
                      >
                        {formatDateShort(date)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* ── Hit target rows (HTML, with scroll-snap-align) ────── */}
            {dates.map((date, i) => (
              <div
                key={date}
                data-date={date}
                className="absolute"
                style={{
                  top: dotY(i) - ROW_HEIGHT / 2,
                  left: 0,
                  width: COLLAPSED_WIDTH,
                  height: ROW_HEIGHT,
                  scrollSnapAlign: 'center',
                }}
              >
                <button
                  className="absolute inset-0 cursor-pointer"
                  style={{ background: 'transparent', border: 'none', padding: 0, zIndex: 2 }}
                  onClick={() => handleDotClick(date)}
                  aria-label={`${date === today ? 'Today' : date}${isLogged(getLogForDate(date)) ? ' (logged)' : ''}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Fixed bottom curve ──────────────────────────────────────── */}
      <svg
        className="absolute bottom-0 left-0 pointer-events-none"
        width={COLLAPSED_WIDTH}
        height={PADDING_BOTTOM + CURVE_RADIUS}
        style={{ zIndex: 3 }}
      >
        <path
          d={`M ${LINE_X},0 A ${CURVE_RADIUS},${CURVE_RADIUS} 0 0,0 0,${CURVE_RADIUS}`}
          fill="none"
          stroke={gradientStops[gradientStops.length - 1]?.color ?? currentPhaseColor}
          strokeWidth={2}
          strokeOpacity={0.5}
          transform={`translate(0, ${PADDING_BOTTOM - CURVE_RADIUS})`}
        />
      </svg>

      {/* ── Slide-out detail shelf content ──────────────────────────── */}
      {shelfOpen && !noStartDate && (
        <div
          className="absolute top-0 h-full overflow-hidden"
          style={{
            left: COLLAPSED_WIDTH,
            width: expandedWidth - COLLAPSED_WIDTH,
            zIndex: 13,
            pointerEvents: 'auto',
          }}
        >
          <div
            className="h-full flex items-center justify-center px-3"
            style={{ position: 'relative' }}
          >
            <ShelfContent
              key={contentKey}
              date={selectedDate}
              log={selectedLog}
              logged={selectedLogged}
              isToday={selectedDate === today}
              color={selectedColor}
              dayCount={selectedDayCount}
              onContentClick={handleShelfContentClick}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── ShelfContent ──────────────────────────────────────────────────────────

interface ShelfContentProps {
  date: string
  log: DailyLog | undefined
  logged: boolean
  isToday: boolean
  color: string
  dayCount: number | undefined
  onContentClick: (date: string) => void
}

function ShelfContent({
  date,
  log,
  logged,
  isToday,
  color,
  dayCount,
  onContentClick,
}: ShelfContentProps) {
  const dateLabel = isToday
    ? 'Today'
    : isYesterday(date)
      ? 'Yesterday'
      : getWeekdayLabel(date)

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
      className="shelf-content-fade"
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={() => onContentClick(date)}
    >
      {/* Date header */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 13,
            color,
            fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {dateLabel}
        </div>
        {dayCount != null && (
          <div
            style={{
              fontSize: 10,
              color: color + '59', // 35% opacity
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: 2,
            }}
          >
            Day {dayCount}
          </div>
        )}
      </div>

      {logged && metrics ? (
        <>
          {/* 2×2 metric grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 10,
            }}
          >
            {metrics.map((m) => (
              <ProgressRing key={m.key} letter={m.key} value={m.value} phaseColor={color} />
            ))}
          </div>

          {/* Flare badge */}
          {log!.flare && (
            <div
              className="flex items-center gap-1"
              style={{
                background: 'rgba(255,107,74,0.12)',
                borderRadius: 8,
                padding: '4px 8px',
                marginTop: 4,
              }}
            >
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
          {/* Unlogged state */}
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              marginBottom: 12,
            }}
          >
            No log
          </div>
          <button
            className={isToday ? 'ticker-today-pulse' : ''}
            style={{
              border: `1px solid ${color}`,
              background: 'transparent',
              color,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              borderRadius: 20,
              padding: '6px 16px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onContentClick(date)
            }}
          >
            Tap to log
          </button>
        </>
      )}
    </div>
  )
}
