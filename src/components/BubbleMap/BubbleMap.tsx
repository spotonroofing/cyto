import { useRef, useState, useCallback, useEffect } from 'react'
import { useBubbleLayout } from './useBubbleLayout'
import { Bubble } from './Bubble'
import { GooCanvas } from './GooCanvas'
import { BackgroundParticles } from './BackgroundParticles'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_TIME_THRESHOLD = 300

// Animated nucleus component — organic morphing ellipses
function MorphingNucleus({ bubble, isDark, time }: {
  bubble: { x: number; y: number; radius: number; phaseIndex: number; milestoneId: string }
  isDark: boolean
  time: number
}) {
  const color = getPhaseColor(bubble.phaseIndex, isDark)
  const baseR = bubble.radius * 0.72

  // Organic deformation
  const breathe = Math.sin(time * 0.5 + bubble.phaseIndex * 0.9) * 2
  const wobbleX = Math.sin(time * 0.35 + bubble.phaseIndex * 1.2) * 1.5
  const wobbleY = Math.cos(time * 0.28 + bubble.phaseIndex * 0.7) * 1.5
  const rx = baseR + breathe + Math.sin(time * 0.4 + bubble.phaseIndex) * 2
  const ry = baseR - breathe + Math.cos(time * 0.3 + bubble.phaseIndex * 1.5) * 2
  const rotation = Math.sin(time * 0.15 + bubble.phaseIndex * 0.6) * 8 // degrees

  return (
    <ellipse
      cx={bubble.x + wobbleX}
      cy={bubble.y + wobbleY}
      rx={Math.max(rx, baseR * 0.8)}
      ry={Math.max(ry, baseR * 0.8)}
      fill={color}
      fillOpacity={0.5}
      transform={`rotate(${rotation}, ${bubble.x + wobbleX}, ${bubble.y + wobbleY})`}
    />
  )
}

export function BubbleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const blurRef = useRef<SVGFEGaussianBlurElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanningRef = useRef(false)
  const lastPanRef = useRef({ x: 0, y: 0 })
  const lastPinchDistRef = useRef(0)

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const hasPannedRef = useRef(false)
  const hasAutoZoomedRef = useRef(false)

  const transformRef = useRef(transform)
  const bubblesRef = useRef<ReturnType<typeof useBubbleLayout>['bubbles']>([])

  // Nucleus animation time
  const [nucleusTime, setNucleusTime] = useState(0)
  const nucleusAnimRef = useRef<number>(0)

  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const getCurrentMilestone = useRoadmapStore((s) => s.getCurrentMilestone)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

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

  useEffect(() => { transformRef.current = transform }, [transform])
  useEffect(() => { bubblesRef.current = bubbles }, [bubbles])

  // Update goo filter stdDeviation when zoom changes
  useEffect(() => {
    if (blurRef.current) {
      // Scale blur with zoom so goo merging stays consistent
      const scaledStd = Math.max(6, 12 * Math.sqrt(transform.scale))
      blurRef.current.setAttribute('stdDeviation', String(scaledStd))
    }
  }, [transform.scale])

  // Nucleus morphing animation loop (lower frequency updates for SVG)
  useEffect(() => {
    let time = 0
    const tick = () => {
      time += 0.016
      setNucleusTime(time)
      nucleusAnimRef.current = requestAnimationFrame(tick)
    }
    nucleusAnimRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(nucleusAnimRef.current)
  }, [])

  // Auto-zoom to current milestone
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

  // Native mouse handlers
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
    const onMouseUp = () => { isPanningRef.current = false }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setTransform((t) => {
        const factor = e.deltaY > 0 ? 0.95 : 1.05
        const ns = Math.max(0.3, Math.min(3, t.scale * factor))
        const r = ns / t.scale
        return { x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r, scale: ns }
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

  // Native touch handlers
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]!
        isPanningRef.current = true
        hasPannedRef.current = false
        lastPanRef.current = { x: t.clientX, y: t.clientY }
        touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
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
        const t = e.touches[0]!
        const dx = t.clientX - lastPanRef.current.x
        const dy = t.clientY - lastPanRef.current.y
        lastPanRef.current = { x: t.clientX, y: t.clientY }
        if (touchStartRef.current) {
          const tdx = t.clientX - touchStartRef.current.x
          const tdy = t.clientY - touchStartRef.current.y
          if (Math.sqrt(tdx * tdx + tdy * tdy) > TAP_DISTANCE_THRESHOLD) hasPannedRef.current = true
        }
        if (hasPannedRef.current) e.preventDefault()
        setTransform((tr) => ({ ...tr, x: tr.x + dx, y: tr.y + dy }))
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const t0 = e.touches[0]!, t1 = e.touches[1]!
        const dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY
        const nd = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDistRef.current > 0) {
          const rect = el.getBoundingClientRect()
          const mx = (t0.clientX + t1.clientX) / 2 - rect.left
          const my = (t0.clientY + t1.clientY) / 2 - rect.top
          const f = nd / lastPinchDistRef.current
          setTransform((t) => {
            const ns = Math.max(0.3, Math.min(3, t.scale * f))
            const r = ns / t.scale
            return { x: mx - (mx - t.x) * r, y: my - (my - t.y) * r, scale: ns }
          })
        }
        lastPinchDistRef.current = nd
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      isPanningRef.current = false
      lastPinchDistRef.current = 0
      if (touchStartRef.current && !hasPannedRef.current) {
        const elapsed = Date.now() - touchStartRef.current.time
        if (elapsed < TAP_TIME_THRESHOLD) {
          const touch = touchStartRef.current
          const rect = el.getBoundingClientRect()
          const svgX = (touch.x - rect.left - transformRef.current.x) / transformRef.current.scale
          const svgY = (touch.y - rect.top - transformRef.current.y) / transformRef.current.scale
          for (const b of bubblesRef.current) {
            const d = Math.sqrt((svgX - b.x) ** 2 + (svgY - b.y) ** 2)
            if (d <= b.radius) { e.preventDefault(); selectMilestone(b.milestoneId); break }
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

  const handleRecenter = useCallback(() => {
    const current = getCurrentMilestone()
    if (!current) return
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) return
    setTransform({
      x: dimensions.width / 2 - bubble.x * 1.2,
      y: dimensions.height / 2 - bubble.y * 1.2,
      scale: 1.2,
    })
  }, [bubbles, dimensions, getCurrentMilestone])

  useEffect(() => {
    const handler = () => handleRecenter()
    window.addEventListener('cyto-recenter', handler)
    return () => window.removeEventListener('cyto-recenter', handler)
  }, [handleRecenter])

  const handleBubbleTap = useCallback(
    (id: string) => selectMilestone(id),
    [selectMilestone],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-screen overflow-hidden relative"
      style={{ touchAction: 'none' }}
    >
      <BackgroundParticles />

      {/* Petri dish vignette — slightly more visible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.07) 100%)',
        }}
      />

      {/* Hidden SVG for goo filter definition — stdDeviation is dynamic */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="goo-filter" colorInterpolationFilters="sRGB">
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation="12"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Goo canvas — milestone blobs + animated tapered connections with goo filter */}
      <GooCanvas
        width={dimensions.width}
        height={dimensions.height}
        bubbles={bubbles}
        links={links}
        transform={transform}
      />

      {/* SVG overlay — morphing nucleus, labels and click targets (no filter) */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Morphing nucleus circles — organic ellipses that breathe and wobble */}
          {bubbles.map((bubble) => (
            <MorphingNucleus
              key={`nucleus-${bubble.milestoneId}`}
              bubble={bubble}
              isDark={isDark}
              time={nucleusTime}
            />
          ))}

          {/* Labels and click targets */}
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
