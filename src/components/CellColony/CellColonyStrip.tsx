import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDailyLogStore } from '@/stores/dailyLogStore'
import { useUIStore } from '@/stores/uiStore'
import { phases } from '@/data/roadmap'
import { useTheme } from '@/themes'
import type { DailyLog } from '@/types'

const DOT_SPACING = 18 // px between day positions
const COLLAPSED_WIDTH = 28
const EXPANDED_WIDTH_MOBILE = 180
const EXPANDED_WIDTH_DESKTOP = 200
const PADDING_TOP = 60
const PADDING_BOTTOM = 80

function todayString(): string {
  return new Date().toISOString().split('T')[0]!
}

/** Determine phase index (0-7) for a day offset from protocol start. */
function getPhaseIndex(dayOffset: number): number {
  for (let i = phases.length - 1; i >= 0; i--) {
    if (dayOffset >= phases[i]!.defaultStartOffset) return i
  }
  return 0
}

/** Get phase color for a given day offset, using the theme palette. */
function getPhaseColorFromPalette(
  dayOffset: number,
  phaseColors: string[],
): string {
  const idx = getPhaseIndex(dayOffset)
  return phaseColors[idx] ?? phaseColors[0]!
}

/** A day is "logged" if it has at least one non-default value. */
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

/** Build list of date strings from protocolStart to today, newest first. */
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
  return dates // newest first (today at index 0)
}

/** Compute current streak (consecutive logged days ending today or yesterday). */
function computeStreak(
  dates: string[],
  getLog: (d: string) => DailyLog | undefined,
): number {
  let streak = 0
  for (const date of dates) {
    if (isLogged(getLog(date))) {
      streak++
    } else {
      if (streak === 0 && date === todayString()) continue
      break
    }
  }
  return streak
}

/** Format date for labels: 'Feb 3', 'Jan 27' */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Get day of week (0=Sun, 1=Mon, ...) */
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay()
}

/** Check if two dates are within N days of each other */
function daysApart(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.abs(
    Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24)),
  )
}

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

  // Phase colors array from current theme
  const phaseColors = useMemo(
    () => Array.from({ length: 8 }, (_, i) => themePhaseColor(i)),
    [themePhaseColor],
  )

  // Date list newest first
  const dates = useMemo(
    () => (protocolStartDate ? buildDateList(protocolStartDate) : [today]),
    [protocolStartDate, today],
  )

  const startDate = useMemo(
    () => new Date((protocolStartDate || today) + 'T00:00:00'),
    [protocolStartDate, today],
  )

  /** Day offset from protocol start for a given date. */
  const getDayOffset = useCallback(
    (date: string) => {
      const d = new Date(date + 'T00:00:00')
      return Math.round(
        (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    },
    [startDate],
  )

  /** Phase color for a given date. */
  const colorForDate = useCallback(
    (date: string) => {
      const offset = getDayOffset(date)
      return getPhaseColorFromPalette(Math.max(0, offset), phaseColors)
    },
    [getDayOffset, phaseColors],
  )

  // Streak
  const streak = useMemo(
    () => computeStreak(dates, getLogForDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dates, logs],
  )

  const currentPhaseColor = colorForDate(today)

  // Expanded width based on viewport
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
        // Second tap on same dot — collapse
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
      // Tapping expanded card opens DailyLogPanel for that date
      openLogForDate(date)
      setExpanded(false)
      setSelectedDate(null)
    },
    [openLogForDate],
  )

  // Determine which dates get labels
  const labelDates = useMemo(() => {
    const labels = new Set<string>()
    // Always label today
    labels.add(today)
    // Every Monday (or every 7th day if no Mondays in range)
    for (const date of dates) {
      if (getDayOfWeek(date) === 1) {
        // Skip if within 2 days of today to avoid overlap
        if (date !== today && daysApart(date, today) <= 2) continue
        labels.add(date)
      }
    }
    return labels
  }, [dates, today])

  // No protocol start date
  const noStartDate = !protocolStartDate

  return (
    <div
      ref={stripRef}
      className="fixed left-0 top-0 h-dvh z-10"
      style={{
        width: expanded ? expandedWidth : COLLAPSED_WIDTH,
        transition: 'width 200ms ease-out',
      }}
    >
      {/* Scrollable ticker area */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto ticker-scroll"
        style={{
          paddingTop: PADDING_TOP,
          paddingBottom: PADDING_BOTTOM,
        }}
      >
        {noStartDate ? (
          <NoStartDateMessage expanded={expanded} color={currentPhaseColor} />
        ) : (
          <TickerContent
            dates={dates}
            today={today}
            streak={streak}
            currentPhaseColor={currentPhaseColor}
            expanded={expanded}
            selectedDate={selectedDate}
            labelDates={labelDates}
            getLogForDate={getLogForDate}
            colorForDate={colorForDate}
            onDotClick={handleDotClick}
            onCardClick={handleCardClick}
          />
        )}
      </div>
    </div>
  )
}

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

interface TickerContentProps {
  dates: string[]
  today: string
  streak: number
  currentPhaseColor: string
  expanded: boolean
  selectedDate: string | null
  labelDates: Set<string>
  getLogForDate: (d: string) => DailyLog | undefined
  colorForDate: (d: string) => string
  onDotClick: (date: string) => void
  onCardClick: (date: string) => void
}

function TickerContent({
  dates,
  today,
  streak,
  currentPhaseColor,
  expanded,
  selectedDate,
  labelDates,
  getLogForDate,
  colorForDate,
  onDotClick,
  onCardClick,
}: TickerContentProps) {
  // Build line gradient: vertical line with phase color segments
  const lineGradient = useMemo(() => {
    if (dates.length <= 1) return currentPhaseColor

    const totalHeight = dates.length * DOT_SPACING

    // Build gradient with color stops at phase transitions
    const simplified: string[] = []
    let prevColor = ''
    for (let i = 0; i < dates.length; i++) {
      const color = colorForDate(dates[i]!)
      const pct = ((i * DOT_SPACING) / totalHeight) * 100
      if (color !== prevColor) {
        if (prevColor) {
          simplified.push(`${prevColor} ${pct.toFixed(1)}%`)
        }
        simplified.push(`${color} ${pct.toFixed(1)}%`)
        prevColor = color
      }
    }
    if (prevColor) simplified.push(`${prevColor} 100%`)

    return `linear-gradient(to bottom, ${simplified.join(', ')})`
  }, [dates, colorForDate, currentPhaseColor])

  return (
    <div className="relative" style={{ width: '100%' }}>
      {/* Streak counter at top */}
      {streak >= 3 && (
        <div
          className="flex items-center justify-center gap-1 mb-2"
          style={{ height: 20, width: COLLAPSED_WIDTH }}
        >
          <span
            style={{
              fontSize: 10,
              color: currentPhaseColor,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {streak}
          </span>
          {/* Tally mark icon */}
          <svg width={3} height={12} viewBox="0 0 3 12">
            <rect
              x={0.5}
              y={0}
              width={2}
              height={12}
              rx={1}
              fill={currentPhaseColor}
              opacity={0.7}
            />
          </svg>
        </div>
      )}

      {/* The vertical line */}
      <div
        className="absolute"
        style={{
          left: COLLAPSED_WIDTH / 2 - 1,
          top: streak >= 3 ? 22 : 0,
          width: 2,
          height: dates.length * DOT_SPACING,
          background: lineGradient,
          borderRadius: 1,
          opacity: 0.5,
        }}
      />

      {/* Day dots */}
      <div style={{ paddingTop: streak >= 3 ? 22 : 0 }}>
        {dates.map((date) => {
          const log = getLogForDate(date)
          const logged = isLogged(log)
          const isToday = date === today
          const color = colorForDate(date)
          const showLabel = labelDates.has(date)
          const isSelected = expanded && selectedDate === date

          return (
            <DayDot
              key={date}
              date={date}
              log={log}
              logged={logged}
              isToday={isToday}
              color={color}
              showLabel={showLabel}
              isSelected={isSelected}
              onDotClick={onDotClick}
              onCardClick={onCardClick}
            />
          )
        })}
      </div>
    </div>
  )
}

interface DayDotProps {
  date: string
  log: DailyLog | undefined
  logged: boolean
  isToday: boolean
  color: string
  showLabel: boolean
  isSelected: boolean
  onDotClick: (date: string) => void
  onCardClick: (date: string) => void
}

function DayDot({
  date,
  log,
  logged,
  isToday,
  color,
  showLabel,
  isSelected,
  onDotClick,
  onCardClick,
}: DayDotProps) {
  // Determine dot rendering
  const dotSize = isToday ? 10 : 8
  const showDot = logged || isToday // unlogged past days: no dot

  return (
    <div
      className="relative"
      style={{ height: DOT_SPACING, width: '100%' }}
    >
      {/* Invisible hit target for tapping */}
      <button
        className="absolute cursor-pointer"
        style={{
          left: 0,
          top: 0,
          width: COLLAPSED_WIDTH,
          height: DOT_SPACING,
          background: 'transparent',
          border: 'none',
          padding: 0,
          zIndex: 2,
        }}
        onClick={() => onDotClick(date)}
        aria-label={`${isToday ? 'Today' : date}${logged ? ' (logged)' : ''}`}
      />

      {/* The dot */}
      {showDot && (
        <div
          className={`absolute${!logged && isToday ? ' ticker-pulse' : ''}`}
          style={{
            left: COLLAPSED_WIDTH / 2 - dotSize / 2,
            top: DOT_SPACING / 2 - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            ...(logged
              ? {
                  // Filled dot
                  backgroundColor: color,
                  boxShadow: `0 0 6px 1px ${color}66`,
                }
              : {
                  // Hollow circle (today, unlogged)
                  backgroundColor: 'transparent',
                  border: `1.5px solid ${color}99`,
                }),
            zIndex: 1,
          }}
        />
      )}

      {/* Date label */}
      {showLabel && (
        <span
          className="absolute whitespace-nowrap pointer-events-none"
          style={{
            left: COLLAPSED_WIDTH / 2 + 10,
            top: DOT_SPACING / 2 - 5,
            fontSize: 9,
            color: color + '80',
            lineHeight: '10px',
          }}
        >
          {isToday ? 'Today' : formatDateLabel(date)}
        </span>
      )}

      {/* Expanded detail card */}
      {isSelected && (
        <DetailCard
          date={date}
          log={log}
          logged={logged}
          isToday={isToday}
          color={color}
          onCardClick={onCardClick}
        />
      )}
    </div>
  )
}

interface DetailCardProps {
  date: string
  log: DailyLog | undefined
  logged: boolean
  isToday: boolean
  color: string
  onCardClick: (date: string) => void
}

function DetailCard({
  date,
  log,
  logged,
  isToday,
  color,
  onCardClick,
}: DetailCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [shiftY, setShiftY] = useState(0)

  // Reposition card if it's near viewport edges
  useEffect(() => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const viewH = window.innerHeight
    if (rect.bottom > viewH - 10) {
      setShiftY(viewH - 10 - rect.bottom)
    } else if (rect.top < 10) {
      setShiftY(10 - rect.top)
    } else {
      setShiftY(0)
    }
  }, [date])

  const metrics = logged && log
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
        top: DOT_SPACING / 2 - 12 + shiftY,
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
      <style>{`
        @keyframes ticker-card-appear {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        className="rounded-xl p-2.5 cursor-pointer"
        style={{
          background: 'rgba(15, 10, 25, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${color}26`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Date */}
        <div style={{ fontSize: 12, color, marginBottom: 6 }}>
          {isToday ? 'Today' : formatDateLabel(date)}
        </div>

        {logged && metrics ? (
          <>
            {/* Metric bars */}
            <div className="flex flex-col gap-1.5">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-center gap-1.5">
                  <span
                    style={{
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.4)',
                      width: 8,
                      flexShrink: 0,
                    }}
                  >
                    {m.key}
                  </span>
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{
                      height: 3,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(m.value / 10) * 100}%`,
                        backgroundColor: color,
                        transition: 'width 200ms ease-out',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.5)',
                      width: 14,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Flare indicator */}
            {log!.flare && (
              <div
                style={{
                  fontSize: 9,
                  color: '#FF6B4A',
                  marginTop: 4,
                }}
              >
                Flare{log!.flareSeverity ? ` ${log!.flareSeverity}` : ''}
              </div>
            )}
          </>
        ) : (
          /* Unlogged day */
          <div
            style={{
              fontSize: 11,
              color: color + '80',
            }}
            {...(isToday ? { className: 'ticker-pulse' } : {})}
          >
            Tap to log
          </div>
        )}
      </div>
    </div>
  )
}
