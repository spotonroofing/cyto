import { useRef, useState, useCallback, useEffect } from 'react'
import { useBubbleLayout } from './useBubbleLayout'
import { Bubble } from './Bubble'
import { GooCanvas } from './GooCanvas'
import { BackgroundParticles } from './BackgroundParticles'
import { DotGrid } from './DotGrid'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useUIStore } from '@/stores/uiStore'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_TIME_THRESHOLD = 300

export function BubbleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const blurRef = useRef<SVGFEGaussianBlurElement>(null)
  const mobileBlurRef = useRef<SVGFEGaussianBlurElement>(null)
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

  // Momentum & boundary refs
  const velocityRef = useRef({ x: 0, y: 0 })
  const lastMoveTimeRef = useRef(0)
  const momentumRafRef = useRef(0)
  const springRafRef = useRef(0)
  const pathBoundsRef = useRef<{ minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } | null>(null)
  const dimensionsRef = useRef(dimensions)

  // RAF batching: accumulate transform deltas, flush once per frame
  const pendingTransformRef = useRef<((t: { x: number; y: number; scale: number }) => { x: number; y: number; scale: number }) | null>(null)
  const rafPendingRef = useRef(0)
  const flushTransform = useCallback(() => {
    rafPendingRef.current = 0
    const fn = pendingTransformRef.current
    if (fn) {
      pendingTransformRef.current = null
      setTransform(fn)
    }
  }, [])
  const batchTransform = useCallback((updater: (t: { x: number; y: number; scale: number }) => { x: number; y: number; scale: number }) => {
    const prev = pendingTransformRef.current
    if (prev) {
      // Compose: apply previous updater first, then new one
      pendingTransformRef.current = (t) => updater(prev(t))
    } else {
      pendingTransformRef.current = updater
    }
    if (!rafPendingRef.current) {
      rafPendingRef.current = requestAnimationFrame(flushTransform)
    }
  }, [flushTransform])

  const recenterModeRef = useRef<'focus' | 'fit-all'>('focus')

  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const getCurrentMilestone = useRoadmapStore((s) => s.getCurrentMilestone)

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
  useEffect(() => { dimensionsRef.current = dimensions }, [dimensions])

  // Update goo filter stdDeviation when zoom changes
  useEffect(() => {
    if (blurRef.current) {
      // Scale blur with zoom so goo merging stays consistent (capped to limit GPU cost)
      const scaledStd = Math.min(18, Math.max(6, 12 * Math.sqrt(transform.scale)))
      blurRef.current.setAttribute('stdDeviation', String(scaledStd))
    }
    if (mobileBlurRef.current) {
      // Mobile: fixed stdDeviation — scaling with zoom is too expensive for mobile GPUs
      mobileBlurRef.current.setAttribute('stdDeviation', '7')
    }
  }, [transform.scale])

  // Compute path bounding box when bubbles change
  useEffect(() => {
    if (bubbles.length === 0) { pathBoundsRef.current = null; return }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const b of bubbles) {
      if (b.x - b.radius < minX) minX = b.x - b.radius
      if (b.x + b.radius > maxX) maxX = b.x + b.radius
      if (b.y - b.radius < minY) minY = b.y - b.radius
      if (b.y + b.radius > maxY) maxY = b.y + b.radius
    }
    const w = maxX - minX, h = maxY - minY
    const padX = w * 0.25, padY = h * 0.25
    pathBoundsRef.current = {
      minX: minX - padX, maxX: maxX + padX,
      minY: minY - padY, maxY: maxY + padY,
      width: w, height: h,
    }
  }, [bubbles])

  // --- Boundary & momentum helpers (use refs, stable across renders) ---

  const getMinScale = useCallback(() => {
    const bounds = pathBoundsRef.current
    if (!bounds) return 0.15
    return Math.max(0.15, (dimensionsRef.current.width * 0.80) / bounds.width)
  }, [])

  const getBoundaryLimits = useCallback((scale: number) => {
    const bounds = pathBoundsRef.current
    const dims = dimensionsRef.current
    if (!bounds) return { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity }
    return {
      minX: dims.width / 2 - bounds.maxX * scale,
      maxX: dims.width / 2 - bounds.minX * scale,
      minY: dims.height / 2 - bounds.maxY * scale,
      maxY: dims.height / 2 - bounds.minY * scale,
    }
  }, [])

  const cancelAnimations = useCallback(() => {
    cancelAnimationFrame(momentumRafRef.current)
    cancelAnimationFrame(springRafRef.current)
  }, [])

  const startSpringBack = useCallback(() => {
    cancelAnimationFrame(springRafRef.current)
    const startTime = performance.now()
    const duration = 300
    const start = { ...transformRef.current }
    const limits = getBoundaryLimits(start.scale)
    const targetX = Math.max(limits.minX, Math.min(limits.maxX, start.x))
    const targetY = Math.max(limits.minY, Math.min(limits.maxY, start.y))
    if (Math.abs(targetX - start.x) < 0.5 && Math.abs(targetY - start.y) < 0.5) return

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setTransform(prev => ({
        ...prev,
        x: start.x + (targetX - start.x) * ease,
        y: start.y + (targetY - start.y) * ease,
      }))
      if (t < 1) springRafRef.current = requestAnimationFrame(animate)
    }
    springRafRef.current = requestAnimationFrame(animate)
  }, [getBoundaryLimits])

  const startMomentum = useCallback(() => {
    cancelAnimationFrame(momentumRafRef.current)
    let vx = velocityRef.current.x
    let vy = velocityRef.current.y

    if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
      startSpringBack()
      return
    }

    const friction = 0.94
    const animate = () => {
      const t = transformRef.current
      const limits = getBoundaryLimits(t.scale)

      // Extra friction when past boundary
      if (t.x > limits.maxX || t.x < limits.minX) vx *= 0.85
      if (t.y > limits.maxY || t.y < limits.minY) vy *= 0.85

      vx *= friction
      vy *= friction

      if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
        startSpringBack()
        return
      }

      setTransform(prev => ({ ...prev, x: prev.x + vx, y: prev.y + vy }))
      momentumRafRef.current = requestAnimationFrame(animate)
    }
    momentumRafRef.current = requestAnimationFrame(animate)
  }, [getBoundaryLimits, startSpringBack])

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
      lastMoveTimeRef.current = performance.now()
      velocityRef.current = { x: 0, y: 0 }
      cancelAnimations()
      recenterModeRef.current = 'focus'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      const dx = e.clientX - lastPanRef.current.x
      const dy = e.clientY - lastPanRef.current.y
      lastPanRef.current = { x: e.clientX, y: e.clientY }

      // Track velocity (based on actual visual movement after resistance)
      const cur = transformRef.current
      const limits = getBoundaryLimits(cur.scale)
      const resistX = (cur.x > limits.maxX || cur.x < limits.minX) ? 0.3 : 1.0
      const resistY = (cur.y > limits.maxY || cur.y < limits.minY) ? 0.3 : 1.0
      const now = performance.now()
      const dt = now - lastMoveTimeRef.current
      lastMoveTimeRef.current = now
      if (dt > 0 && dt < 100) {
        const newVx = (dx * resistX) / dt * 16
        const newVy = (dy * resistY) / dt * 16
        velocityRef.current = {
          x: velocityRef.current.x * 0.7 + newVx * 0.3,
          y: velocityRef.current.y * 0.7 + newVy * 0.3,
        }
      }

      batchTransform((t) => {
        const lim = getBoundaryLimits(t.scale)
        const rx = (t.x > lim.maxX || t.x < lim.minX) ? 0.3 : 1.0
        const ry = (t.y > lim.maxY || t.y < lim.minY) ? 0.3 : 1.0
        return { ...t, x: t.x + dx * rx, y: t.y + dy * ry }
      })
    }
    const onMouseUp = () => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      startMomentum()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cancelAnimations()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      batchTransform((t) => {
        const factor = e.deltaY > 0 ? 0.95 : 1.05
        const ns = Math.max(getMinScale(), Math.min(3, t.scale * factor))
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
      cancelAnimationFrame(momentumRafRef.current)
      cancelAnimationFrame(springRafRef.current)
    }
  }, [batchTransform, cancelAnimations, getBoundaryLimits, getMinScale, startMomentum])

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
        lastMoveTimeRef.current = performance.now()
        velocityRef.current = { x: 0, y: 0 }
        cancelAnimations()
        recenterModeRef.current = 'focus'
        window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
      } else if (e.touches.length === 2) {
        isPanningRef.current = false
        hasPannedRef.current = false
        touchStartRef.current = null
        velocityRef.current = { x: 0, y: 0 }
        cancelAnimations()
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

        // Track velocity (based on actual visual movement after resistance)
        const cur = transformRef.current
        const limits = getBoundaryLimits(cur.scale)
        const resistX = (cur.x > limits.maxX || cur.x < limits.minX) ? 0.3 : 1.0
        const resistY = (cur.y > limits.maxY || cur.y < limits.minY) ? 0.3 : 1.0
        const now = performance.now()
        const dt = now - lastMoveTimeRef.current
        lastMoveTimeRef.current = now
        if (dt > 0 && dt < 100) {
          const newVx = (dx * resistX) / dt * 16
          const newVy = (dy * resistY) / dt * 16
          velocityRef.current = {
            x: velocityRef.current.x * 0.7 + newVx * 0.3,
            y: velocityRef.current.y * 0.7 + newVy * 0.3,
          }
        }

        batchTransform((tr) => {
          const lim = getBoundaryLimits(tr.scale)
          const rx = (tr.x > lim.maxX || tr.x < lim.minX) ? 0.3 : 1.0
          const ry = (tr.y > lim.maxY || tr.y < lim.minY) ? 0.3 : 1.0
          return { ...tr, x: tr.x + dx * rx, y: tr.y + dy * ry }
        })
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
          batchTransform((t) => {
            const ns = Math.max(getMinScale(), Math.min(3, t.scale * f))
            const r = ns / t.scale
            return { x: mx - (mx - t.x) * r, y: my - (my - t.y) * r, scale: ns }
          })
        }
        lastPinchDistRef.current = nd
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      const wasPanning = hasPannedRef.current
      isPanningRef.current = false
      lastPinchDistRef.current = 0
      if (touchStartRef.current && !wasPanning) {
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
      // Start momentum if user was panning, otherwise spring-back after pinch zoom
      if (wasPanning) startMomentum()
      else if (e.touches.length === 0) startSpringBack()
    }
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      cancelAnimationFrame(momentumRafRef.current)
      cancelAnimationFrame(springRafRef.current)
    }
  }, [selectMilestone, batchTransform, cancelAnimations, getBoundaryLimits, getMinScale, startMomentum, startSpringBack])

  const handleRecenter = useCallback(() => {
    cancelAnimations()
    if (recenterModeRef.current === 'focus') {
      // Focus on current milestone
      const current = getCurrentMilestone()
      if (!current) return
      const bubble = bubbles.find((b) => b.milestoneId === current.id)
      if (!bubble) return
      setTransform({
        x: dimensions.width / 2 - bubble.x * 1.2,
        y: dimensions.height / 2 - bubble.y * 1.2,
        scale: 1.2,
      })
      recenterModeRef.current = 'fit-all'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'fit-all' }))
    } else {
      // Fit entire map
      if (bubbles.length === 0) return
      const minX = Math.min(...bubbles.map(b => b.x - b.radius))
      const maxX = Math.max(...bubbles.map(b => b.x + b.radius))
      const minY = Math.min(...bubbles.map(b => b.y - b.radius))
      const maxY = Math.max(...bubbles.map(b => b.y + b.radius))
      const mapW = maxX - minX + 100  // padding
      const mapH = maxY - minY + 100
      const scale = Math.max(getMinScale(), Math.min(dimensions.width / mapW, dimensions.height / mapH, 1))
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      setTransform({
        x: dimensions.width / 2 - cx * scale,
        y: dimensions.height / 2 - cy * scale,
        scale,
      })
      recenterModeRef.current = 'focus'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
    }
  }, [bubbles, dimensions, getCurrentMilestone, cancelAnimations, getMinScale])

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
      <DotGrid width={dimensions.width} height={dimensions.height} transform={transform} />

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
          {/* Lighter goo filter for mobile — smaller blur radius (~4x cheaper) */}
          <filter id="goo-filter-mobile" colorInterpolationFilters="sRGB">
            <feGaussianBlur
              ref={mobileBlurRef}
              in="SourceGraphic"
              stdDeviation="7"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
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

      {/* SVG overlay — labels and click targets (no filter) */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
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
