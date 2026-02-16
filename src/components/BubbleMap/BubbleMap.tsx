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
      const delta = e.deltaY > 0 ? 0.95 : 1.05
      setTransform((t) => ({
        ...t,
        scale: Math.max(0.3, Math.min(3, t.scale * delta)),
      }))
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
        const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
        const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDistRef.current > 0) {
          const delta = dist / lastPinchDistRef.current
          setTransform((t) => ({
            ...t,
            scale: Math.max(0.3, Math.min(3, t.scale * delta)),
          }))
        }
        lastPinchDistRef.current = dist
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
          {/* Organic wobble filter — makes circles look like cell membranes */}
          <filter id="organic-wobble" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves={3}
              seed="2"
              result="turbulence"
            >
              <animate
                attributeName="seed"
                values="1;5;3;8;2;7;4;1"
                dur="12s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="6"
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
          {/* Connection membranes (behind milestones) */}
          <ConnectionLines links={links} />

          {/* Milestone circles — solid fill with organic wobble filter */}
          <g filter="url(#organic-wobble)">
            {bubbles.map((bubble) => (
              <circle
                key={`cell-${bubble.milestoneId}`}
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.radius}
                fill={getPhaseColor(bubble.phaseIndex, isDark)}
                fillOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.25 : 0.6}
              />
            ))}
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
