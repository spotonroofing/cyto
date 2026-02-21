import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { useBubbleLayout } from './useBubbleLayout'
import { Bubble } from './Bubble'
import { GooCanvas } from './GooCanvas'
import { BackgroundParticles } from './BackgroundParticles'
import { DotGrid } from './DotGrid'
import { useRoadmapStore } from '@/stores/roadmapStore'
import { useUIStore } from '@/stores/uiStore'
import { useTuningStore } from '@/stores/tuningStore'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_TIME_THRESHOLD = 300
const EDGE_PADDING = 40 // px from screen edge for auto-zoom fit
const AUTO_ZOOM_EASE = 0.15 // per-frame lerp factor (~300ms to 95%)
const MAX_SINGLE_SCALE = 1.2 // max zoom for single-column sections

/** Compute release velocity from recent Y deltas (last 80ms window). */
function computeReleaseVelocity(history: Array<{ dy: number; time: number }>): number {
  if (history.length < 2) return 0
  const now = performance.now()
  let i = 0
  while (i < history.length && now - history[i]!.time > 80) i++
  if (i >= history.length) return 0
  let totalDy = 0
  for (let j = i; j < history.length; j++) totalDy += history[j]!.dy
  const dt = now - history[i]!.time
  if (dt < 16) return totalDy
  return (totalDy / dt) * 16
}

/** Progressive drag resistance past boundary. */
function overdragResist(pos: number, min: number, max: number): number {
  if (pos > max) return 1 / (1 + (pos - max) * 0.02)
  if (pos < min) return 1 / (1 + (min - pos) * 0.02)
  return 1.0
}

export function BubbleMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const isPanningRef = useRef(false)
  const lastPanYRef = useRef(0)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const hasPannedRef = useRef(false)
  const hasAutoZoomedRef = useRef(false)
  const hasSetInitialViewRef = useRef(false)

  const transformRef = useRef(transform)
  const bubblesRef = useRef<ReturnType<typeof useBubbleLayout>['bubbles']>([])
  const rowBandsRef = useRef<ReturnType<typeof useBubbleLayout>['rowBands']>([])

  const moveHistoryRef = useRef<Array<{ dy: number; time: number }>>([])
  const momentumRafRef = useRef(0)
  const cameraAnimRafRef = useRef(0)
  const isAnimatingCameraRef = useRef(false)
  const wheelTimeoutRef = useRef(0)

  const pathBoundsRef = useRef<{ minY: number; maxY: number } | null>(null)
  const dimensionsRef = useRef(dimensions)
  const worldCenterXRef = useRef(0)

  // RAF batching
  const pendingTransformRef = useRef<
    ((t: { x: number; y: number; scale: number }) => { x: number; y: number; scale: number }) | null
  >(null)
  const rafPendingRef = useRef(0)
  const flushTransform = useCallback(() => {
    rafPendingRef.current = 0
    const fn = pendingTransformRef.current
    if (fn) {
      pendingTransformRef.current = null
      setTransform(fn)
    }
  }, [])
  const batchTransform = useCallback(
    (
      updater: (t: { x: number; y: number; scale: number }) => {
        x: number
        y: number
        scale: number
      },
    ) => {
      const prev = pendingTransformRef.current
      if (prev) {
        pendingTransformRef.current = (t) => updater(prev(t))
      } else {
        pendingTransformRef.current = updater
      }
      if (!rafPendingRef.current) {
        rafPendingRef.current = requestAnimationFrame(flushTransform)
      }
    },
    [flushTransform],
  )

  const recenterModeRef = useRef<'focus' | 'fit-all'>('focus')
  const selectMilestone = useUIStore((s) => s.selectMilestone)
  const getCurrentMilestone = useRoadmapStore((s) => s.getCurrentMilestone)

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

  const { bubbles, links, settled, rowBands } = useBubbleLayout(dimensions.width, dimensions.height)
  const particleSpreadX = useTuningStore((s) => s.particleSpreadX)

  // World center X for horizontal centering
  const worldCenterX = useMemo(() => {
    if (bubbles.length === 0) return dimensions.width / 2
    const xs = bubbles.map((b) => b.x)
    return (Math.min(...xs) + Math.max(...xs)) / 2
  }, [bubbles, dimensions.width])

  // Map bounds for particles (particleSpreadX widens the horizontal range)
  const mapBounds = useMemo(() => {
    if (bubbles.length === 0) return null
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    for (const b of bubbles) {
      if (b.x - b.radius < minX) minX = b.x - b.radius
      if (b.x + b.radius > maxX) maxX = b.x + b.radius
      if (b.y - b.radius < minY) minY = b.y - b.radius
      if (b.y + b.radius > maxY) maxY = b.y + b.radius
    }
    const rawW = maxX - minX
    const midX = (minX + maxX) / 2
    const spreadW = rawW * particleSpreadX
    const padX = spreadW * 0.12
    const padY = (maxY - minY) * 0.12
    return {
      minX: midX - spreadW / 2 - padX,
      maxX: midX + spreadW / 2 + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    }
  }, [bubbles, particleSpreadX])

  // Sync refs
  useEffect(() => {
    transformRef.current = transform
  }, [transform])
  useEffect(() => {
    bubblesRef.current = bubbles
  }, [bubbles])
  useEffect(() => {
    rowBandsRef.current = rowBands
  }, [rowBands])
  useEffect(() => {
    dimensionsRef.current = dimensions
  }, [dimensions])
  useEffect(() => {
    worldCenterXRef.current = worldCenterX
  }, [worldCenterX])

  // Compute path bounds (Y-only for vertical scroll)
  useEffect(() => {
    if (bubbles.length === 0) {
      pathBoundsRef.current = null
      return
    }
    let minY = Infinity,
      maxY = -Infinity
    for (const b of bubbles) {
      if (b.y - b.radius < minY) minY = b.y - b.radius
      if (b.y + b.radius > maxY) maxY = b.y + b.radius
    }
    const padY = (maxY - minY) * 0.15
    pathBoundsRef.current = { minY: minY - padY, maxY: maxY + padY }
  }, [bubbles])

  // --- Helpers ---

  /** Compute X offset to keep content horizontally centered at given scale. */
  const computeX = useCallback((scale: number) => {
    return dimensionsRef.current.width / 2 - worldCenterXRef.current * scale
  }, [])

  /** Get vertical scroll boundaries for given scale. */
  const getScrollBounds = useCallback((scale: number) => {
    const bounds = pathBoundsRef.current
    const dims = dimensionsRef.current
    const viewH = Math.min(dims.height, window.innerHeight || dims.height)
    if (!bounds) return { minY: -Infinity, maxY: Infinity }
    return {
      minY: viewH / 2 - bounds.maxY * scale,
      maxY: viewH / 2 - bounds.minY * scale,
    }
  }, [])

  /** Compute target zoom scale based on which row bands are visible. */
  const getTargetScale = useCallback((scrollY: number, currentScale: number) => {
    const dims = dimensionsRef.current
    const bands = rowBandsRef.current
    if (dims.width === 0 || bands.length === 0) return MAX_SINGLE_SCALE

    // World-space Y range currently visible
    const visYStart = -scrollY / currentScale
    const visYEnd = (dims.height - scrollY) / currentScale

    // Lookahead padding prevents jitter at fork boundaries: without this,
    // bands at the viewport edge pop in/out causing the target scale to
    // oscillate between fork-zoom and single-column zoom.
    const pad = (visYEnd - visYStart) * 0.35

    // Find widest content among visible row bands (with padding)
    let maxContentWidth = 0
    let hasVisible = false
    for (const band of bands) {
      if (band.yEnd >= visYStart - pad && band.yStart <= visYEnd + pad) {
        maxContentWidth = Math.max(maxContentWidth, band.contentWidth)
        hasVisible = true
      }
    }

    if (!hasVisible) return currentScale
    const fitScale = (dims.width - EDGE_PADDING * 2) / maxContentWidth
    return Math.min(fitScale, MAX_SINGLE_SCALE)
  }, [])

  const cancelAnimations = useCallback(() => {
    cancelAnimationFrame(momentumRafRef.current)
    cancelAnimationFrame(cameraAnimRafRef.current)
    isAnimatingCameraRef.current = false
  }, [])

  // --- Camera animation (for nav buttons) ---
  const animateCamera = useCallback(
    (target: { x: number; y: number; scale: number }, duration = 600) => {
      cancelAnimations()
      const start = { ...transformRef.current }
      if (
        Math.abs(target.x - start.x) < 1 &&
        Math.abs(target.y - start.y) < 1 &&
        Math.abs(target.scale - start.scale) < 0.001
      )
        return

      isAnimatingCameraRef.current = true
      const startTime = performance.now()
      const tick = (now: number) => {
        const elapsed = now - startTime
        const rawT = Math.min(elapsed / duration, 1)
        const t =
          rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2
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
    },
    [cancelAnimations],
  )

  // --- Scroll physics (Y-only with auto-zoom) ---
  const startPhysics = useCallback(
    (vy0: number) => {
      cancelAnimationFrame(momentumRafRef.current)
      let vy = vy0

      const cur = transformRef.current
      const lim0 = getScrollBounds(cur.scale)
      const oy0 =
        cur.y > lim0.maxY
          ? cur.y - lim0.maxY
          : cur.y < lim0.minY
            ? cur.y - lim0.minY
            : 0
      const scaleTarget = getTargetScale(cur.y, cur.scale)
      const scaleOff = Math.abs(scaleTarget - cur.scale)
      if (Math.abs(vy) < 0.5 && Math.abs(oy0) < 0.5 && scaleOff < 0.001) {
        return
      }

      const FRICTION = 0.92
      const TENSION = 0.15
      const SPRING_DAMP = 0.5

      const animate = () => {
        const t = transformRef.current
        const limits = getScrollBounds(t.scale)

        const overY =
          t.y > limits.maxY
            ? t.y - limits.maxY
            : t.y < limits.minY
              ? t.y - limits.minY
              : 0

        vy -= overY * TENSION
        vy *= overY !== 0 ? SPRING_DAMP : FRICTION

        // Auto-zoom: ease scale toward target.
        // Freeze zoom during bounce to prevent feedback between spring and auto-zoom.
        const targetScale = overY === 0 ? getTargetScale(t.y + vy, t.scale) : t.scale
        const newScale = t.scale + (targetScale - t.scale) * AUTO_ZOOM_EASE
        const newX = computeX(newScale)

        // Compensate Y when auto-zoom changes scale to keep viewport center
        // anchored at the same world-space point. Without this, scale changes
        // shift the scroll bounds, pushing the position out of bounds and
        // triggering a spring -> auto-zoom feedback loop (fork bounce bug).
        let baseY = t.y
        if (Math.abs(newScale - t.scale) > 0.0001) {
          const dims = dimensionsRef.current
          const viewH = Math.min(dims.height, window.innerHeight || dims.height)
          const centerWorldY = (viewH / 2 - t.y) / t.scale
          baseY = viewH / 2 - centerWorldY * newScale
        }

        // Settle check
        const scaleSettled = Math.abs(targetScale - newScale) < 0.001
        if (Math.abs(vy) < 0.3 && Math.abs(overY) < 0.5 && scaleSettled) {
          if (overY !== 0) {
            setTransform((prev) => ({
              x: computeX(prev.scale),
              y: Math.max(limits.minY, Math.min(limits.maxY, prev.y)),
              scale: prev.scale,
            }))
          }
          return
        }

        setTransform({ x: newX, y: baseY + vy, scale: newScale })
        momentumRafRef.current = requestAnimationFrame(animate)
      }

      momentumRafRef.current = requestAnimationFrame(animate)
    },
    [getScrollBounds, getTargetScale, computeX],
  )

  // --- Initial view: zoom-to-fit before first paint ---
  useLayoutEffect(() => {
    if (hasSetInitialViewRef.current || bubbles.length === 0 || dimensions.width === 0) return
    hasSetInitialViewRef.current = true

    const viewH = Math.min(dimensions.height, window.innerHeight || dimensions.height)
    const minX = Math.min(...bubbles.map((b) => b.x - b.radius))
    const maxX = Math.max(...bubbles.map((b) => b.x + b.radius))
    const minY = Math.min(...bubbles.map((b) => b.y - b.radius))
    const maxY = Math.max(...bubbles.map((b) => b.y + b.radius))
    const mapW = maxX - minX + 100
    const mapH = maxY - minY + 100
    const fitScale = Math.min(dimensions.width / mapW, viewH / mapH, MAX_SINGLE_SCALE)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setTransform({
      x: dimensions.width / 2 - cx * fitScale,
      y: viewH / 2 - cy * fitScale,
      scale: fitScale,
    })
    isAnimatingCameraRef.current = true
  }, [bubbles, dimensions])

  // --- Intro animation: fly to current milestone ---
  useEffect(() => {
    if (!settled || hasAutoZoomedRef.current || bubbles.length === 0) return
    hasAutoZoomedRef.current = true

    const current = getCurrentMilestone()
    if (!current) {
      isAnimatingCameraRef.current = false
      return
    }
    const bubble = bubbles.find((b) => b.milestoneId === current.id)
    if (!bubble) {
      isAnimatingCameraRef.current = false
      return
    }

    const viewH = Math.min(dimensions.height, window.innerHeight || dimensions.height)
    const scale = Math.min(
      getTargetScale(viewH / 2 - bubble.y * MAX_SINGLE_SCALE, MAX_SINGLE_SCALE),
      MAX_SINGLE_SCALE,
    )
    const target = {
      x: computeX(scale),
      y: viewH / 2 - bubble.y * scale,
      scale,
    }

    const start = { ...transformRef.current }
    const startTime = performance.now()
    const FLY_MS = 1100
    const tick = (now: number) => {
      const rawT = Math.min((now - startTime) / FLY_MS, 1)
      const t =
        rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2
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

    return () => {
      cancelAnimationFrame(cameraAnimRafRef.current)
      isAnimatingCameraRef.current = false
    }
  }, [settled, bubbles, dimensions, getCurrentMilestone, getTargetScale, computeX])

  // --- Mouse handlers: drag = vertical scroll, wheel = vertical scroll ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isAnimatingCameraRef.current) return
      isPanningRef.current = true
      lastPanYRef.current = e.clientY
      moveHistoryRef.current = []
      cancelAnimations()
      recenterModeRef.current = 'focus'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      const dy = e.clientY - lastPanYRef.current
      lastPanYRef.current = e.clientY

      const cur = transformRef.current
      const limits = getScrollBounds(cur.scale)
      const resistY = overdragResist(cur.y, limits.minY, limits.maxY)
      moveHistoryRef.current.push({ dy: dy * resistY, time: performance.now() })
      if (moveHistoryRef.current.length > 5) moveHistoryRef.current.shift()

      batchTransform((t) => {
        const lim = getScrollBounds(t.scale)
        const ry = overdragResist(t.y, lim.minY, lim.maxY)
        const newY = t.y + dy * ry
        const targetScale = getTargetScale(newY, t.scale)
        const newScale = t.scale + (targetScale - t.scale) * AUTO_ZOOM_EASE
        return { x: computeX(newScale), y: newY, scale: newScale }
      })
    }

    const onMouseUp = () => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      const vy = computeReleaseVelocity(moveHistoryRef.current)
      startPhysics(vy * 0.5)
    }

    // Wheel: vertical scroll with momentum
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isAnimatingCameraRef.current) return
      cancelAnimationFrame(momentumRafRef.current)

      const scrollDy = -e.deltaY
      moveHistoryRef.current.push({ dy: scrollDy, time: performance.now() })
      if (moveHistoryRef.current.length > 5) moveHistoryRef.current.shift()

      batchTransform((t) => {
        const lim = getScrollBounds(t.scale)
        const ry = overdragResist(t.y, lim.minY, lim.maxY)
        const newY = t.y + scrollDy * ry
        const targetScale = getTargetScale(newY, t.scale)
        const newScale = t.scale + (targetScale - t.scale) * AUTO_ZOOM_EASE
        return { x: computeX(newScale), y: newY, scale: newScale }
      })

      // Debounce: start momentum after wheel events stop
      clearTimeout(wheelTimeoutRef.current)
      wheelTimeoutRef.current = window.setTimeout(() => {
        const vy = computeReleaseVelocity(moveHistoryRef.current)
        startPhysics(vy * 0.3)
      }, 100)
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
      cancelAnimationFrame(cameraAnimRafRef.current)
      clearTimeout(wheelTimeoutRef.current)
    }
  }, [batchTransform, cancelAnimations, getScrollBounds, getTargetScale, computeX, startPhysics])

  // --- Touch handlers: drag = vertical scroll, pinch = zoom ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastPinchDist = 0

    const onTouchStart = (e: TouchEvent) => {
      if (isAnimatingCameraRef.current) return
      if (e.touches.length === 1) {
        const t = e.touches[0]!
        isPanningRef.current = true
        hasPannedRef.current = false
        lastPanYRef.current = t.clientY
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
        lastPinchDist = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isPanningRef.current) {
        const t = e.touches[0]!
        const dy = t.clientY - lastPanYRef.current
        lastPanYRef.current = t.clientY

        if (touchStartRef.current) {
          const tdx = t.clientX - touchStartRef.current.x
          const tdy = t.clientY - touchStartRef.current.y
          if (Math.sqrt(tdx * tdx + tdy * tdy) > TAP_DISTANCE_THRESHOLD)
            hasPannedRef.current = true
        }
        if (hasPannedRef.current) e.preventDefault()

        const cur = transformRef.current
        const limits = getScrollBounds(cur.scale)
        const resistY = overdragResist(cur.y, limits.minY, limits.maxY)
        moveHistoryRef.current.push({ dy: dy * resistY, time: performance.now() })
        if (moveHistoryRef.current.length > 5) moveHistoryRef.current.shift()

        batchTransform((tr) => {
          const lim = getScrollBounds(tr.scale)
          const ry = overdragResist(tr.y, lim.minY, lim.maxY)
          const newY = tr.y + dy * ry
          const targetScale = getTargetScale(newY, tr.scale)
          const newScale = tr.scale + (targetScale - tr.scale) * AUTO_ZOOM_EASE
          return { x: computeX(newScale), y: newY, scale: newScale }
        })
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const t0 = e.touches[0]!,
          t1 = e.touches[1]!
        const dx = t0.clientX - t1.clientX,
          dy = t0.clientY - t1.clientY
        const nd = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDist > 0) {
          const f = nd / lastPinchDist
          const my = (t0.clientY + t1.clientY) / 2 - el.getBoundingClientRect().top
          batchTransform((t) => {
            const ns = Math.max(0.5, Math.min(3, t.scale * f))
            const r = ns / t.scale
            return { x: computeX(ns), y: my - (my - t.y) * r, scale: ns }
          })
        }
        lastPinchDist = nd
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      const wasPanning = hasPannedRef.current
      isPanningRef.current = false
      lastPinchDist = 0

      if (touchStartRef.current && !wasPanning) {
        const elapsed = Date.now() - touchStartRef.current.time
        if (elapsed < TAP_TIME_THRESHOLD) {
          const touch = touchStartRef.current
          const rect = el.getBoundingClientRect()
          const svgX =
            (touch.x - rect.left - transformRef.current.x) / transformRef.current.scale
          const svgY =
            (touch.y - rect.top - transformRef.current.y) / transformRef.current.scale
          for (const b of bubblesRef.current) {
            const d = Math.sqrt((svgX - b.x) ** 2 + (svgY - b.y) ** 2)
            if (d <= b.radius) {
              e.preventDefault()
              selectMilestone(b.milestoneId)
              break
            }
          }
        }
      }

      touchStartRef.current = null
      hasPannedRef.current = false

      if (wasPanning) {
        const vy = computeReleaseVelocity(moveHistoryRef.current)
        startPhysics(vy * 0.5)
      } else if (e.touches.length === 0) {
        startPhysics(0)
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
      cancelAnimationFrame(cameraAnimRafRef.current)
    }
  }, [
    selectMilestone,
    batchTransform,
    cancelAnimations,
    getScrollBounds,
    getTargetScale,
    computeX,
    startPhysics,
  ])

  // --- Recenter handler ---
  const handleRecenter = useCallback(() => {
    const viewH = Math.min(dimensions.height, window.innerHeight || dimensions.height)

    if (recenterModeRef.current === 'focus') {
      const current = getCurrentMilestone()
      if (!current) return
      const bubble = bubbles.find((b) => b.milestoneId === current.id)
      if (!bubble) return
      const scale = Math.min(
        getTargetScale(viewH / 2 - bubble.y * MAX_SINGLE_SCALE, MAX_SINGLE_SCALE),
        MAX_SINGLE_SCALE,
      )
      animateCamera({
        x: computeX(scale),
        y: viewH / 2 - bubble.y * scale,
        scale,
      })
      recenterModeRef.current = 'fit-all'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'fit-all' }))
    } else {
      if (bubbles.length === 0) return
      const minX = Math.min(...bubbles.map((b) => b.x - b.radius))
      const maxX = Math.max(...bubbles.map((b) => b.x + b.radius))
      const minY = Math.min(...bubbles.map((b) => b.y - b.radius))
      const maxY = Math.max(...bubbles.map((b) => b.y + b.radius))
      const mapW = maxX - minX + 100
      const mapH = maxY - minY + 100
      const scale = Math.min(dimensions.width / mapW, viewH / mapH, MAX_SINGLE_SCALE)
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      animateCamera({
        x: dimensions.width / 2 - cx * scale,
        y: viewH / 2 - cy * scale,
        scale,
      })
      recenterModeRef.current = 'focus'
      window.dispatchEvent(new CustomEvent('cyto-recenter-mode', { detail: 'focus' }))
    }
  }, [bubbles, dimensions, getCurrentMilestone, animateCamera, getTargetScale, computeX])

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
      className="w-full h-dvh overflow-hidden relative"
      style={{ touchAction: 'none' }}
    >
        <BackgroundParticles transform={transform} mapBounds={mapBounds} />
        <DotGrid width={dimensions.width} height={dimensions.height} transform={transform} />

        {/* Hidden SVG for nucleus goo filter */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="nucleus-goo" colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
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
          <g
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          >
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
