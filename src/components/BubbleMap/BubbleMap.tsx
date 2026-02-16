import { useRef, useState, useCallback, useEffect } from 'react'
import { useBubbleLayout } from './useBubbleLayout'
import { Bubble } from './Bubble'
import { ConnectionLines } from './ConnectionLines'
import { BackgroundParticles } from './BackgroundParticles'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_TIME_THRESHOLD = 300

// Generate a blobby SVG path from center, radius, and seed
function blobPath(cx: number, cy: number, r: number, seed: number, variance: number = 0.15): string {
  const points = 8
  const angleStep = (Math.PI * 2) / points
  const rand = (i: number) => {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  const pts: [number, number][] = []
  for (let i = 0; i < points; i++) {
    const a = angleStep * i
    const rv = r * (1 + (rand(i) - 0.5) * variance * 2)
    pts.push([cx + Math.cos(a) * rv, cy + Math.sin(a) * rv])
  }
  let d = `M ${pts[0]![0]},${pts[0]![1]}`
  for (let i = 0; i < points; i++) {
    const curr = pts[i]!
    const next = pts[(i + 1) % points]!
    const prev = pts[(i - 1 + points) % points]!
    const nextNext = pts[(i + 2) % points]!
    const cp1x = curr[0] + (next[0] - prev[0]) * 0.25
    const cp1y = curr[1] + (next[1] - prev[1]) * 0.25
    const cp2x = next[0] - (nextNext[0] - curr[0]) * 0.25
    const cp2y = next[1] - (nextNext[1] - curr[1]) * 0.25
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next[0]},${next[1]}`
  }
  d += ' Z'
  return d
}

function mileSeed(id: string): number {
  return id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

export function BubbleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Pan and zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanningRef = useRef(false)
  const lastPanRef = useRef({ x: 0, y: 0 })
  const lastPinchDistRef = useRef(0)

  // Touch tap detection
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const hasPannedRef = useRef(false)

  // Auto-zoom tracking
  const hasAutoZoomedRef = useRef(false)

  // Refs for native event handlers (can't read React state in closure)
  const transformRef = useRef(transform)
  const bubblesRef = useRef<ReturnType<typeof useBubbleLayout>['bubbles']>([])

  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const getCurrentMilestone = useRoadmapStore((s) => s.getCurrentMilestone)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const { bubbles, links, settled } = useBubbleLayout(dimensions.width, dimensions.height)

  // Keep refs in sync
  useEffect(() => { transformRef.current = transform }, [transform])
  useEffect(() => { bubblesRef.current = bubbles }, [bubbles])

  // Auto-zoom to current milestone when simulation first settles
  useEffect(() => {
    if (!settled || hasAutoZoomedRef.current || bubbles.length === 0) return
    hasAutoZoomedRef.current = true

    const current = getCurrentMilestone()
    if (!current) return
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) return

    const scale = 1.2
    setTransform({
      x: dimensions.width / 2 - bubble.x * scale,
      y: dimensions.height / 2 - bubble.y * scale,
      scale,
    })
  }, [settled, bubbles, dimensions, getCurrentMilestone])

  // Native mouse handlers (bypass SVG pointer-events issues)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      isPanningRef.current = true
      lastPanRef.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      const dx = e.clientX - lastPanRef.current.x
      const dy = e.clientY - lastPanRef.current.y
      lastPanRef.current = { x: e.clientX, y: e.clientY }
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }

    const onMouseUp = () => {
      isPanningRef.current = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top

      setTransform((t) => {
        const factor = e.deltaY > 0 ? 0.95 : 1.05
        const newScale = Math.max(0.3, Math.min(3, t.scale * factor))
        const scaleChange = newScale / t.scale
        return {
          x: cursorX - (cursorX - t.x) * scaleChange,
          y: cursorY - (cursorY - t.y) * scaleChange,
          scale: newScale,
        }
      })
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Native touch handlers (passive: false required for preventDefault on mobile)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]!
        isPanningRef.current = true
        hasPannedRef.current = false
        lastPanRef.current = { x: touch.clientX, y: touch.clientY }
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      } else if (e.touches.length === 2) {
        isPanningRef.current = false
        touchStartRef.current = null
        const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
        const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
        lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isPanningRef.current) {
        const touch = e.touches[0]!
        const dx = touch.clientX - lastPanRef.current.x
        const dy = touch.clientY - lastPanRef.current.y
        lastPanRef.current = { x: touch.clientX, y: touch.clientY }

        if (touchStartRef.current) {
          const totalDx = touch.clientX - touchStartRef.current.x
          const totalDy = touch.clientY - touchStartRef.current.y
          const totalDist = Math.sqrt(totalDx * totalDx + totalDy * totalDy)
          if (totalDist > TAP_DISTANCE_THRESHOLD) {
            hasPannedRef.current = true
          }
        }

        if (hasPannedRef.current) {
          e.preventDefault()
        }

        setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }))
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const t0 = e.touches[0]!
        const t1 = e.touches[1]!
        const dx = t0.clientX - t1.clientX
        const dy = t0.clientY - t1.clientY
        const newDist = Math.sqrt(dx * dx + dy * dy)

        if (lastPinchDistRef.current > 0) {
          const rect = containerRef.current?.getBoundingClientRect()
          const midX = (t0.clientX + t1.clientX) / 2 - (rect?.left ?? 0)
          const midY = (t0.clientY + t1.clientY) / 2 - (rect?.top ?? 0)
          const factor = newDist / lastPinchDistRef.current

          setTransform((t) => {
            const newScale = Math.max(0.3, Math.min(3, t.scale * factor))
            const scaleChange = newScale / t.scale
            return {
              x: midX - (midX - t.x) * scaleChange,
              y: midY - (midY - t.y) * scaleChange,
              scale: newScale,
            }
          })
        }
        lastPinchDistRef.current = newDist
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      isPanningRef.current = false
      lastPinchDistRef.current = 0

      if (touchStartRef.current && !hasPannedRef.current) {
        const elapsed = Date.now() - touchStartRef.current.time
        if (elapsed < TAP_TIME_THRESHOLD) {
          const touch = touchStartRef.current
          const rect = containerRef.current?.getBoundingClientRect()
          const offsetX = rect?.left ?? 0
          const offsetY = rect?.top ?? 0
          const svgX = (touch.x - offsetX - transformRef.current.x) / transformRef.current.scale
          const svgY = (touch.y - offsetY - transformRef.current.y) / transformRef.current.scale

          for (const bubble of bubblesRef.current) {
            const dx = svgX - bubble.x
            const dy = svgY - bubble.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist <= bubble.radius) {
              e.preventDefault()
              selectMilestone(bubble.milestoneId)
              break
            }
          }
        }
      }

      touchStartRef.current = null
      hasPannedRef.current = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [selectMilestone])

  // Recenter on current milestone
  const handleRecenter = useCallback(() => {
    const current = getCurrentMilestone()
    if (!current) return
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) return
    const scale = 1.2
    setTransform({
      x: dimensions.width / 2 - bubble.x * scale,
      y: dimensions.height / 2 - bubble.y * scale,
      scale,
    })
  }, [bubbles, dimensions, getCurrentMilestone])

  // Listen for recenter events from App-level button
  useEffect(() => {
    const handler = () => handleRecenter()
    window.addEventListener('cyto-recenter', handler)
    return () => window.removeEventListener('cyto-recenter', handler)
  }, [handleRecenter])

  const handleBubbleTap = useCallback(
    (milestoneId: string) => {
      selectMilestone(milestoneId)
    },
    [selectMilestone],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-screen overflow-hidden relative"
      style={{ touchAction: 'none' }}
    >
      {/* Microscope background particles */}
      <BackgroundParticles />

      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ zIndex: 1, pointerEvents: 'none' }}
      >
        <defs>
          {/* Organic wobble filter — static turbulence for cell membrane edges */}
          <filter id="organic-wobble" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.035"
              numOctaves={2}
              seed="3"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="10"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Lighter wobble for connections */}
          <filter id="organic-wobble-light" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.03"
              numOctaves={1}
              seed="7"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Glow filters for overdue milestones */}
          <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor="#FF8C00" floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#FF4444" floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Connection membranes with light wobble */}
          <g filter="url(#organic-wobble-light)">
            <ConnectionLines links={links} />
          </g>

          {/* Milestone blobs — animated blob paths with organic wobble filter */}
          <g filter="url(#organic-wobble)">
            {bubbles.map((bubble) => {
              const seed = mileSeed(bubble.milestoneId)
              const b1 = blobPath(bubble.x, bubble.y, bubble.radius, seed, 0.12)
              const b2 = blobPath(bubble.x, bubble.y, bubble.radius, seed + 50, 0.16)
              const b3 = blobPath(bubble.x, bubble.y, bubble.radius, seed + 100, 0.10)
              return (
                <path
                  key={`cell-${bubble.milestoneId}`}
                  d={b1}
                  fill={getPhaseColor(bubble.phaseIndex, isDark)}
                  fillOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.25 : 0.6}
                >
                  <animate
                    attributeName="d"
                    values={`${b1};${b2};${b3};${b1}`}
                    dur="10s"
                    repeatCount="indefinite"
                  />
                </path>
              )
            })}
          </g>

          {/* Overlay layer — labels and click targets (NOT filtered) */}
          {bubbles.map((bubble) => (
            <Bubble
              key={bubble.milestoneId}
              milestoneId={bubble.milestoneId}
              x={bubble.x}
              y={bubble.y}
              radius={bubble.radius}
              progress={bubble.progress}
              onTap={handleBubbleTap}
            />
          ))}
        </g>
      </svg>

    </div>
  )
}
