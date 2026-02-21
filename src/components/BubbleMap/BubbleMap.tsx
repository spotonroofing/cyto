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

/** Compute release velocity from recent move deltas (last 80ms window). */
function computeReleaseVelocity(history: Array<{dx: number; dy: number; time: number}>): { x: number; y: number } {
  if (history.length < 2) return { x: 0, y: 0 }
  const now = performance.now()
  // Only use moves within the last 80ms — stale data means the user paused
  let i = 0
  while (i < history.length && now - history[i]!.time > 80) i++
  if (i >= history.length) return { x: 0, y: 0 }
  let totalDx = 0, totalDy = 0
  for (let j = i; j < history.length; j++) {
    totalDx += history[j]!.dx
    totalDy += history[j]!.dy
  }
  const dt = now - history[i]!.time
  if (dt < 16) return { x: totalDx, y: totalDy } // single frame — use delta as velocity
  return { x: totalDx / dt * 16, y: totalDy / dt * 16 } // normalize to px/frame at 60fps
}

/** Progressive drag resistance past boundary — increases the further you pull. */
function overdragResist(pos: number, min: number, max: number): number {
  if (pos > max) return 1 / (1 + (pos - max) * 0.02)
  if (pos < min) return 1 / (1 + (min - pos) * 0.02)
  return 1.0
}

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
  const moveHistoryRef = useRef<Array<{dx: number; dy: number; time: number}>>([])
  const momentumRafRef = useRef(0)
  const springRafRef = useRef(0)
  const cameraAnimRafRef = useRef(0)
  const isAnimatingCameraRef = useRef(false)
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
      // Scale blur linearly with zoom — keeps goo shape identical at all zoom levels.
      // The filter operates in screen space on already-zoomed canvas content, so
      // stdDeviation must scale proportionally with zoom to maintain the same
      // relative blur radius (σ / feature_size = constant).
      blurRef.current.setAttribute('stdDeviation', String(12 * transform.scale))
    }
    if (mobileBlurRef.current) {
      // Mobile: also scale linearly for consistent goo shape across zoom levels
      mobileBlurRef.current.setAttribute('stdDeviation', String(7 * transform.scale))
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
    cancelAnimationFrame(cameraAnimRafRef.current)
    isAnimatingCameraRef.current = false
  }, [])

  const animateCamera = useCallback((target: { x: number; y: number; scale: number }, duration = 600) => {
    cancelAnimations()
    const start = { ...transformRef.current }
    // Skip if already at target
    if (Math.abs(target.x - start.x) < 1 && Math.abs(target.y - start.y) < 1 && Math.abs(target.scale - start.scale) < 0.001) return

    isAnimatingCameraRef.current = true
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const rawT = Math.min(elapsed / duration, 1)
      // Ease-out cubic: fast start, gentle settle
      const t = 1 - Math.pow(1 - rawT, 3)
      setTransform({
        x: start.x + (target.x - start.x) * t,
        y: start.y + (target.y - start.y) * t,
        scale: start.scale + (target.scale - start.scale) * t,
      })
      if (rawT < 1) {
        cameraAnimRafRef.current = requestAnimationFrame(tick)
      } else {
        isAnimatingCameraRef.current = false
      }
    }
    cameraAnimRafRef.current = requestAnimationFrame(tick)
  }, [cancelAnimations])

  const startPhysics = useCallback((vx0: number, vy0: number) => {
    cancelAnimationFrame(momentumRafRef.current)
    cancelAnimationFrame(springRafRef.current)
    let vx = vx0, vy = vy0

    // Skip if nothing to animate
    const cur = transformRef.current
    const lim0 = getBoundaryLimits(cur.scale)
    const ox0 = cur.x > lim0.maxX ? cur.x - lim0.maxX : cur.x < lim0.minX ? cur.x - lim0.minX : 0
    const oy0 = cur.y > lim0.maxY ? cur.y - lim0.maxY : cur.y < lim0.minY ? cur.y - lim0.minY : 0
    if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5 && Math.abs(ox0) < 0.5 && Math.abs(oy0) < 0.5) return

    const FRICTION = 0.92     // free-space per-frame velocity retention
    const TENSION = 0.15      // spring force per px of overdrag
    const SPRING_DAMP = 0.7   // velocity retention when spring is active (smooth return)

    const animate = () => {
      const t = transformRef.current
      const limits = getBoundaryLimits(t.scale)

      const overX = t.x > limits.maxX ? t.x - limits.maxX : t.x < limits.minX ? t.x - limits.minX : 0
      const overY = t.y > limits.maxY ? t.y - limits.maxY : t.y < limits.minY ? t.y - limits.minY : 0

      // Spring force: pulls back when past boundary (0 when in bounds)
      vx -= overX * TENSION
      vy -= overY * TENSION

      // Damping: heavy when spring active (rubber band), light in free space (coast)
      const inSpring = overX !== 0 || overY !== 0
      vx *= inSpring ? SPRING_DAMP : FRICTION
      vy *= inSpring ? SPRING_DAMP : FRICTION

      // Settle: low velocity AND near/in bounds
      if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3 && Math.abs(overX) < 0.5 && Math.abs(overY) < 0.5) {
        if (overX !== 0 || overY !== 0) {
          setTransform(prev => ({
            ...prev,
            x: Math.max(limits.minX, Math.min(limits.maxX, prev.x)),
            y: Math.max(limits.minY, Math.min(limits.maxY, prev.y)),
          }))
        }
        return
      }

      setTransform(prev => ({ ...prev, x: prev.x + vx, y: prev.y + vy }))
      momentumRafRef.current = requestAnimationFrame(animate)
    }

    momentumRafRef.current = requestAnimationFrame(animate)
  }, [getBoundaryLimits])

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
      if (isAnimatingCameraRef.current) return
      isPanningRef.current = true
      lastPanRef.current = { x: e.clientX, y: e.clientY }
      moveHistoryRef.current = []
      cancelAnimations()
      recenterModeRef.current = 'focus'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      const dx = e.clientX - lastPanRef.current.x
      const dy = e.clientY - lastPanRef.current.y
      lastPanRef.current = { x: e.clientX, y: e.clientY }

      // Track movement for release velocity computation
      const cur = transformRef.current
      const limits = getBoundaryLimits(cur.scale)
      const resistX = overdragResist(cur.x, limits.minX, limits.maxX)
      const resistY = overdragResist(cur.y, limits.minY, limits.maxY)
      const history = moveHistoryRef.current
      history.push({ dx: dx * resistX, dy: dy * resistY, time: performance.now() })
      if (history.length > 5) history.shift()

      batchTransform((t) => {
        const lim = getBoundaryLimits(t.scale)
        const rx = overdragResist(t.x, lim.minX, lim.maxX)
        const ry = overdragResist(t.y, lim.minY, lim.maxY)
        return { ...t, x: t.x + dx * rx, y: t.y + dy * ry }
      })
    }
    const onMouseUp = () => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      const vel = computeReleaseVelocity(moveHistoryRef.current)
      startPhysics(vel.x * 0.5, vel.y * 0.5)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isAnimatingCameraRef.current) return
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
      cancelAnimationFrame(cameraAnimRafRef.current)
    }
  }, [batchTransform, cancelAnimations, getBoundaryLimits, getMinScale, startPhysics])

  // Native touch handlers
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchStart = (e: TouchEvent) => {
      if (isAnimatingCameraRef.current) return
      if (e.touches.length === 1) {
        const t = e.touches[0]!
        isPanningRef.current = true
        hasPannedRef.current = false
        lastPanRef.current = { x: t.clientX, y: t.clientY }
        touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
        moveHistoryRef.current = []
        cancelAnimations()
        recenterModeRef.current = 'focus'
        window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
      } else if (e.touches.length === 2) {
        isPanningRef.current = false
        hasPannedRef.current = false
        touchStartRef.current = null
        moveHistoryRef.current = []
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

        // Track movement for release velocity computation
        const cur = transformRef.current
        const limits = getBoundaryLimits(cur.scale)
        const resistX = overdragResist(cur.x, limits.minX, limits.maxX)
        const resistY = overdragResist(cur.y, limits.minY, limits.maxY)
        const history = moveHistoryRef.current
        history.push({ dx: dx * resistX, dy: dy * resistY, time: performance.now() })
        if (history.length > 5) history.shift()

        batchTransform((tr) => {
          const lim = getBoundaryLimits(tr.scale)
          const rx = overdragResist(tr.x, lim.minX, lim.maxX)
          const ry = overdragResist(tr.y, lim.minY, lim.maxY)
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
      if (wasPanning) {
        const vel = computeReleaseVelocity(moveHistoryRef.current)
        startPhysics(vel.x * 0.5, vel.y * 0.5)
      } else if (e.touches.length === 0) {
        startPhysics(0, 0)
      }
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
      cancelAnimationFrame(cameraAnimRafRef.current)
    }
  }, [selectMilestone, batchTransform, cancelAnimations, getBoundaryLimits, getMinScale, startPhysics])

  const handleRecenter = useCallback(() => {
    if (recenterModeRef.current === 'focus') {
      // Focus on current milestone
      const current = getCurrentMilestone()
      if (!current) return
      const bubble = bubbles.find((b) => b.milestoneId === current.id)
      if (!bubble) return
      animateCamera({
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
      animateCamera({
        x: dimensions.width / 2 - cx * scale,
        y: dimensions.height / 2 - cy * scale,
        scale,
      })
      recenterModeRef.current = 'focus'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
    }
  }, [bubbles, dimensions, getCurrentMilestone, animateCamera, getMinScale])

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
      <BackgroundParticles scale={transform.scale} />
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
