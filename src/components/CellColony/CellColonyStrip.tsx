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
const LINE_X = 18
const CURVE_R = 18
const CURVE_AREA = 20
const ROW_HEIGHT = 28
const DOT_R = 4
const DOT_R_SELECTED = 5.5
const DOT_R_TODAY = 5
const HALO_R = 7

// ── Progress ring constants ───────────────────────────────────────────────
const RING_SIZE = 36
const RING_STROKE = 3
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRC = 2 * Math.PI * RING_RADIUS

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

function getPhaseDarkColor(dayOffset: number): string {
  const idx = getPhaseIndex(dayOffset)
  return phases[idx]?.darkColor ?? phases[0]!.darkColor
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
  return dates
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
    <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ display: 'block', transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={phaseColor}
          strokeOpacity={0.1}
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <text
          x={RING_SIZE / 2}
          y={RING_SIZE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.55)"
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
        >
          {letter}
        </text>
      </svg>
      <div
        style={{
          fontSize: 8,
          color,
          opacity: 0.7,
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 1,
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
  const { palette, phaseColor: themePhaseColor } = useTheme()

  const [shelfOpen, setShelfOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(todayString())
  const [contentKey, setContentKey] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

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

  // Active phase dark color for the line stroke
  const lineColor = useMemo(() => {
    const offset = getDayOffset(today)
    return getPhaseDarkColor(Math.max(0, offset))
  }, [getDayOffset, today])

  // Running day counter
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

  const expandedWidth =
    typeof window !== 'undefined' && window.innerWidth < 768
      ? EXPANDED_WIDTH_MOBILE
      : EXPANDED_WIDTH_DESKTOP

  const bgColor = palette.bg

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

  // ── Click outside to close shelf ────────────────────────────────────────
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

  // ── Swipe gestures ──────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]!
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return
      const dx = e.changedTouches[0]!.clientX - touchStartRef.current.x
      const dy = e.changedTouches[0]!.clientY - touchStartRef.current.y
      touchStartRef.current = null

      if (Math.abs(dx) <= Math.abs(dy)) return

      if (dx > 40 && !shelfOpen) {
        e.stopPropagation()
        setShelfOpen(true)
      } else if (dx < -40 && shelfOpen) {
        e.stopPropagation()
        setShelfOpen(false)
      }
    },
    [shelfOpen],
  )

  // ── Dot tap handler ─────────────────────────────────────────────────────
  const handleDotClick = useCallback(
    (date: string) => {
      if (selectedDate === date && shelfOpen) {
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

  const noStartDate = !protocolStartDate
  const contentHeight = dates.length * ROW_HEIGHT
  const dotY = (i: number) => i * ROW_HEIGHT + ROW_HEIGHT / 2
  const selectedIndex = dates.indexOf(selectedDate)

  const selectedLog = getLogForDate(selectedDate)
  const selectedLogged = isLogged(selectedLog)
  const selectedColor = colorForDate(selectedDate)
  const selectedDayCount = dayCounterMap.get(selectedDate)

  return (
    <div
      ref={stripRef}
      className="fixed left-0"
      style={{
        top: 60,
        width: shelfOpen ? expandedWidth : COLLAPSED_WIDTH,
        height: '50vh',
        transition: 'width 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        zIndex: shelfOpen ? 12 : 10,
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Shelf background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: shelfOpen ? 'rgba(10, 8, 18, 0.92)' : 'transparent',
          backdropFilter: shelfOpen ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: shelfOpen ? 'blur(14px)' : 'none',
          borderRight: shelfOpen ? `1px solid ${selectedColor}1A` : 'none',
          borderRadius: shelfOpen ? '0 16px 16px 0' : '0',
          transition: 'background 250ms, border-radius 250ms',
        }}
      />

      {/* Top curve */}
      <svg
        className="absolute left-0 pointer-events-none"
        width={COLLAPSED_WIDTH}
        height={CURVE_AREA}
        style={{ top: 0, zIndex: 3 }}
      >
        <path
          d={`M 0,0 A ${CURVE_R},${CURVE_R} 0 0,1 ${LINE_X},${CURVE_AREA}`}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      </svg>

      {/* Scrollable snap area */}
      <div
        ref={scrollRef}
        className="absolute left-0 overflow-y-auto ticker-scroll"
        style={{
          top: CURVE_AREA,
          bottom: CURVE_AREA,
          width: '100%',
          scrollSnapType: 'y mandatory',
          touchAction: 'pan-y',
        }}
      >
        {noStartDate ? (
          <div
            className="flex items-center justify-center h-full px-2"
            style={{
              fontSize: 10,
              color: selectedColor + '80',
              textAlign: 'center',
            }}
          >
            {shelfOpen ? 'Set start date in Settings' : ''}
          </div>
        ) : (
          <div className="relative" style={{ height: contentHeight, width: '100%' }}>
            {/* Vertical line + dots SVG */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={COLLAPSED_WIDTH}
              height={contentHeight}
              style={{ zIndex: 1 }}
            >
              <line
                x1={LINE_X}
                y1={0}
                x2={LINE_X}
                y2={contentHeight}
                stroke={lineColor}
                strokeWidth={2}
                strokeOpacity={0.5}
              />

              {/* Dark halos */}
              {dates.map((date, i) => {
                const log = getLogForDate(date)
                const logged = isLogged(log)
                if (!logged && date !== today) return null
                return (
                  <circle
                    key={`h-${date}`}
                    cx={LINE_X}
                    cy={dotY(i)}
                    r={HALO_R}
                    fill={bgColor}
                  />
                )
              })}

              {/* Dots */}
              {dates.map((date, i) => {
                const log = getLogForDate(date)
                const logged = isLogged(log)
                if (!logged && date !== today) return null

                const cy = dotY(i)
                const color = colorForDate(date)
                const isSel = date === selectedDate

                if (logged) {
                  return (
                    <circle
                      key={`d-${date}`}
                      cx={LINE_X}
                      cy={cy}
                      r={isSel ? DOT_R_SELECTED : DOT_R}
                      fill={color}
                      style={{
                        transition: 'r 100ms ease-out',
                        filter: isSel ? `drop-shadow(0 0 8px ${color}66)` : 'none',
                      }}
                    />
                  )
                }

                return (
                  <circle
                    key={`d-${date}`}
                    cx={LINE_X}
                    cy={cy}
                    r={isSel ? DOT_R_SELECTED : DOT_R_TODAY}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={0.5}
                    className="ticker-today-pulse"
                    style={{
                      transition: 'r 100ms ease-out',
                      filter: isSel ? `drop-shadow(0 0 8px ${color}66)` : 'none',
                    }}
                  />
                )
              })}
            </svg>

            {/* Hit target rows + selected day labels */}
            {dates.map((date, i) => {
              const isSel = date === selectedDate
              const count = dayCounterMap.get(date)
              const color = colorForDate(date)

              return (
                <div
                  key={date}
                  data-date={date}
                  className="absolute"
                  style={{
                    top: dotY(i) - ROW_HEIGHT / 2,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                    scrollSnapAlign: 'center',
                  }}
                >
                  <button
                    className="absolute cursor-pointer"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      top: 0,
                      left: 0,
                      width: COLLAPSED_WIDTH,
                      height: ROW_HEIGHT,
                      zIndex: 2,
                    }}
                    onClick={() => handleDotClick(date)}
                    aria-label={`${date === today ? 'Today' : date}${isLogged(getLogForDate(date)) ? ' (logged)' : ''}`}
                  />

                  {isSel && count != null && (
                    <div
                      className="absolute pointer-events-none shelf-content-fade"
                      style={{
                        left: LINE_X + 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color,
                          opacity: 0.5,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontFeatureSettings: '"tnum"',
                          lineHeight: 1.2,
                        }}
                      >
                        {count}
                      </div>
                      <div
                        style={{
                          fontSize: 7,
                          color,
                          opacity: 0.5,
                          fontFamily: "'JetBrains Mono', monospace",
                          lineHeight: 1.2,
                        }}
                      >
                        {formatDateShort(date)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom curve */}
      <svg
        className="absolute left-0 bottom-0 pointer-events-none"
        width={COLLAPSED_WIDTH}
        height={CURVE_AREA}
        style={{ zIndex: 3 }}
      >
        <path
          d={`M ${LINE_X},0 A ${CURVE_R},${CURVE_R} 0 0,0 0,${CURVE_AREA}`}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      </svg>

      {/* Shelf content */}
      {shelfOpen && !noStartDate && (
        <ShelfPanel
          key={contentKey}
          date={selectedDate}
          log={selectedLog}
          logged={selectedLogged}
          isToday={selectedDate === today}
          color={selectedColor}
          dayCount={selectedDayCount}
          scrollRef={scrollRef}
          selectedIndex={selectedIndex}
          onContentClick={handleShelfContentClick}
          expandedWidth={expandedWidth}
        />
      )}
    </div>
  )
}

// ── ShelfPanel ────────────────────────────────────────────────────────────

interface ShelfPanelProps {
  date: string
  log: DailyLog | undefined
  logged: boolean
  isToday: boolean
  color: string
  dayCount: number | undefined
  scrollRef: React.RefObject<HTMLDivElement | null>
  selectedIndex: number
  onContentClick: (date: string) => void
  expandedWidth: number
}

function ShelfPanel({
  date,
  log,
  logged,
  isToday,
  color,
  dayCount,
  scrollRef,
  selectedIndex,
  onContentClick,
  expandedWidth,
}: ShelfPanelProps) {
  const [shelfTop, setShelfTop] = useState(0)

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || selectedIndex < 0) return

    const updatePos = () => {
      const dotYInContent = selectedIndex * ROW_HEIGHT + ROW_HEIGHT / 2
      const scrollTop = scrollEl.scrollTop
      const dotScreenY = CURVE_AREA + dotYInContent - scrollTop

      const shelfHeight = 160
      const minTop = CURVE_AREA + 8
      const maxTop = scrollEl.offsetHeight + CURVE_AREA - shelfHeight - 8
      const idealTop = dotScreenY - shelfHeight / 2
      setShelfTop(Math.max(minTop, Math.min(maxTop, idealTop)))
    }

    updatePos()
    scrollEl.addEventListener('scroll', updatePos, { passive: true })
    return () => scrollEl.removeEventListener('scroll', updatePos)
  }, [scrollRef, selectedIndex])

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
      className="absolute shelf-content-fade"
      style={{
        left: COLLAPSED_WIDTH,
        top: shelfTop,
        width: expandedWidth - COLLAPSED_WIDTH,
        zIndex: 13,
        pointerEvents: 'auto',
        padding: '0 12px',
      }}
      onClick={() => onContentClick(date)}
    >
      <div
        style={{
          fontSize: 12,
          color,
          opacity: 0.8,
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {dateLabel}
      </div>

      {dayCount != null && (
        <div
          style={{
            fontSize: 9,
            color,
            opacity: 0.3,
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          Day {dayCount}
        </div>
      )}

      {logged && metrics ? (
        <>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 10,
              alignItems: 'flex-start',
            }}
          >
            {metrics.map((m) => (
              <ProgressRing key={m.key} letter={m.key} value={m.value} phaseColor={color} />
            ))}
          </div>

          {log!.flare && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 8,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: '#FF6B4A',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  color: '#FF6B4A',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Flare{log!.flareSeverity ? ` ${log!.flareSeverity}` : ''}
              </span>
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 10 }}>
          <button
            className={isToday ? 'ticker-today-pulse' : ''}
            style={{
              border: `1px solid ${color}`,
              background: 'transparent',
              color,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              borderRadius: 16,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onContentClick(date)
            }}
          >
            Tap to log
          </button>
        </div>
      )}
    </div>
  )
}
