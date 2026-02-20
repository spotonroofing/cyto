import { useRef, useEffect } from 'react'
import { useTheme } from '@/themes'
import type { LayoutBubble, LayoutLink } from './useBubbleLayout'

interface GooCanvasProps {
  width: number
  height: number
  bubbles: LayoutBubble[]
  links: LayoutLink[]
  transform: { x: number; y: number; scale: number }
}

// ── Precomputed connection data (recomputed on layout change) ──

interface ConnectionData {
  // Source / target world positions and radii
  sx: number; sy: number; sr: number
  tx: number; ty: number; tr: number
  // Direction and distance
  dx: number; dy: number; dist: number
  // Unit tangent
  ux: number; uy: number
  // Unit normal (perpendicular)
  nx: number; ny: number
  // Colors
  sourceColor: string
  targetColor: string
  // Per-connection animation offsets (random but stable per layout)
  phaseOffset: number
  flowSpeed: number
  wobbleFreq: number
  // Fan-out counts for branch goo cleanup
  sourceFanOut: number
  targetFanOut: number
  // Bounding box for viewport culling (world coords, with padding)
  minX: number; minY: number; maxX: number; maxY: number
}

interface BlobData {
  x: number; y: number; radius: number
  color: string
  phaseIndex: number
  // Per-blob animation offsets
  breathePhase: number
  wobblePhase: number
  deformFreq: number
  // Nucleus-specific
  nucleusHarmonics: number[]  // 4-6 random amplitudes for multi-harmonic shape
  nucleusPhases: number[]     // matching phase offsets
  nucleusRotSpeed: number     // rotation speed
}

// ── Detect mobile once at module level ──
const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 768 || 'ontouchstart' in window)

// ── Sampling helpers ──────────────────────────────────────────

function sampleConnection(
  conn: ConnectionData,
  t: number, // 0..1 along path
  time: number,
): { x: number; y: number; width: number } {
  // Very subtle organic curve — NOT a sag, just a gentle living wobble
  const curveBow = Math.sin(t * Math.PI) * conn.dist * 0.008
  // Gentle flow wave, damped hard at endpoints
  const dampEnds = Math.sin(t * Math.PI)  // 0 at edges, 1 at center
  const flowWave = Math.sin(time * conn.flowSpeed + t * 4 + conn.phaseOffset) * 4 * dampEnds

  const x = conn.sx + conn.dx * t + conn.nx * (curveBow + flowWave)
  const y = conn.sy + conn.dy * t + conn.ny * (curveBow + flowWave)

  // Taper: thick at cells, still substantial in middle
  const distFromEdge = Math.min(t, 1 - t) * 2  // 0 at edges, 1 at center
  const smallerR = Math.min(conn.sr, conn.tr)

  // Reduce thickness at fan-out points (where branches split)
  const sourceFan = conn.sourceFanOut || 1
  const targetFan = conn.targetFanOut || 1
  const fanReduction = t < 0.5
    ? (sourceFan > 2 ? 0.6 : 1)
    : (targetFan > 2 ? 0.6 : 1)

  const endWidth = smallerR * 0.45 * fanReduction
  const midWidth = smallerR * 0.14
  // Smooth taper — stays thick longer, narrows gently
  const taper = midWidth + (endWidth - midWidth) * Math.pow(1 - distFromEdge, 1.2)

  // Subtle width pulse
  const widthPulse = Math.sin(time * 0.5 + t * 3 + conn.phaseOffset) * 1.5 * dampEnds
  const width = Math.max(midWidth * 0.8, taper + widthPulse)

  return { x, y, width }
}

// ── Viewport culling helper ──────────────────────────────────

function isInViewport(
  minX: number, minY: number, maxX: number, maxY: number,
  tx: number, ty: number, scale: number,
  viewW: number, viewH: number,
): boolean {
  // Convert world-space AABB to screen-space
  const screenMinX = minX * scale + tx
  const screenMinY = minY * scale + ty
  const screenMaxX = maxX * scale + tx
  const screenMaxY = maxY * scale + ty
  // Check overlap with viewport (with generous padding for goo filter bleed)
  const pad = 60
  return screenMaxX >= -pad && screenMinX <= viewW + pad &&
         screenMaxY >= -pad && screenMinY <= viewH + pad
}

// ── Main component ────────────────────────────────────────────

export function GooCanvas({ width, height, bubbles, links, transform }: GooCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const connectionsRef = useRef<ConnectionData[]>([])
  const blobsRef = useRef<BlobData[]>([])
  const animFrameRef = useRef<number>(0)
  // Store transform in a ref so animation loop reads it without restarting
  const transformRef = useRef(transform)
  const { phaseColor, palette } = useTheme()
  const paletteRef = useRef(palette)

  // Keep refs in sync without restarting animation loop
  useEffect(() => { transformRef.current = transform }, [transform])
  useEffect(() => { paletteRef.current = palette }, [palette])

  // Precompute connection and blob data when layout changes
  useEffect(() => {
    const conns: ConnectionData[] = []
    for (const link of links) {
      const sx = link.source.x, sy = link.source.y, sr = link.source.radius
      const tx = link.target.x, ty = link.target.y, tr = link.target.radius
      const dx = tx - sx, dy = ty - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue

      const ux = dx / dist, uy = dy / dist
      const nx = -uy, ny = ux

      // Compute bounding box with padding for wobble
      const pad = Math.max(sr, tr) * 0.6
      const minX = Math.min(sx, tx) - pad
      const minY = Math.min(sy, ty) - pad
      const maxX = Math.max(sx, tx) + pad
      const maxY = Math.max(sy, ty) + pad

      conns.push({
        sx, sy, sr, tx, ty, tr,
        dx, dy, dist, ux, uy, nx, ny,
        sourceColor: phaseColor(link.sourcePhaseIndex),
        targetColor: phaseColor(link.targetPhaseIndex),
        phaseOffset: Math.random() * Math.PI * 2,
        flowSpeed: 0.4 + Math.random() * 0.3,
        wobbleFreq: 3 + Math.random() * 2,
        sourceFanOut: 1,
        targetFanOut: 1,
        minX, minY, maxX, maxY,
      })
    }

    // Count how many connections share each endpoint
    const endpointCount = new Map<string, number>()
    for (const conn of conns) {
      const sKey = `${conn.sx},${conn.sy}`
      const tKey = `${conn.tx},${conn.ty}`
      endpointCount.set(sKey, (endpointCount.get(sKey) || 0) + 1)
      endpointCount.set(tKey, (endpointCount.get(tKey) || 0) + 1)
    }

    // Store fan-out counts on each connection
    for (const conn of conns) {
      const sKey = `${conn.sx},${conn.sy}`
      const tKey = `${conn.tx},${conn.ty}`
      conn.sourceFanOut = endpointCount.get(sKey) || 1
      conn.targetFanOut = endpointCount.get(tKey) || 1
    }

    connectionsRef.current = conns

    const blobs: BlobData[] = bubbles.map((b) => ({
      x: b.x,
      y: b.y,
      radius: b.radius,
      color: phaseColor(b.phaseIndex),
      phaseIndex: b.phaseIndex,
      breathePhase: b.phaseIndex * 0.9 + Math.random() * 0.5,
      wobblePhase: Math.random() * Math.PI * 2,
      deformFreq: 2 + Math.random(),
      // Multi-harmonic nucleus shape — each blob gets unique deformation
      nucleusHarmonics: Array.from({ length: 5 }, () => 1.5 + Math.random() * 4),
      nucleusPhases: Array.from({ length: 5 }, () => Math.random() * Math.PI * 2),
      nucleusRotSpeed: 0.08 + Math.random() * 0.12,
    }))
    blobsRef.current = blobs
  }, [links, bubbles, palette])

  // Animation loop — does NOT depend on transform (reads from ref)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const isMobile = IS_MOBILE || width < 768
    const SAMPLES_PER_100PX = isMobile ? 4 : 8
    // Mobile: fewer steps for blob/nucleus shapes
    const BLOB_STEPS = isMobile ? 24 : 48
    const NUCLEUS_STEPS = isMobile ? 24 : 64
    const NUCLEUS_HARMONICS = isMobile ? 3 : 5

    let time = 0
    let lastFrameTime = 0
    const TARGET_DT = isMobile ? 1000 / 30 : 1000 / 45 // 30fps mobile, 45fps desktop

    const draw = (timestamp: number) => {
      // Frame rate limiting
      if (timestamp - lastFrameTime < TARGET_DT * 0.8) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrameTime = timestamp
      time += 0.016

      const tf = transformRef.current
      const pal = paletteRef.current

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.translate(tf.x, tf.y)
      ctx.scale(tf.scale, tf.scale)

      const connections = connectionsRef.current
      const blobs = blobsRef.current

      // ── Draw connections as thick tapered filled paths ──

      for (const conn of connections) {
        // Viewport culling
        if (!isInViewport(conn.minX, conn.minY, conn.maxX, conn.maxY,
            tf.x, tf.y, tf.scale, width, height)) continue

        const segments = Math.max(8, Math.floor(conn.dist / 100 * SAMPLES_PER_100PX))

        // Sample points along the connection
        const points: { x: number; y: number; width: number }[] = []
        for (let i = 0; i <= segments; i++) {
          const t = i / segments
          points.push(sampleConnection(conn, t, time))
        }

        // Compute upper and lower outlines
        const upper: { x: number; y: number }[] = []
        const lower: { x: number; y: number }[] = []

        for (let i = 0; i < points.length; i++) {
          const p = points[i]!
          // Compute local normal direction
          let lnx: number, lny: number
          if (i === 0) {
            const next = points[1]!
            const tdx = next.x - p.x, tdy = next.y - p.y
            const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1
            lnx = -tdy / tlen; lny = tdx / tlen
          } else if (i === points.length - 1) {
            const prev = points[i - 1]!
            const tdx = p.x - prev.x, tdy = p.y - prev.y
            const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1
            lnx = -tdy / tlen; lny = tdx / tlen
          } else {
            const prev = points[i - 1]!, next = points[i + 1]!
            const tdx = next.x - prev.x, tdy = next.y - prev.y
            const tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1
            lnx = -tdy / tlen; lny = tdx / tlen
          }
          upper.push({ x: p.x + lnx * p.width, y: p.y + lny * p.width })
          lower.push({ x: p.x - lnx * p.width, y: p.y - lny * p.width })
        }

        // Draw filled shape with smooth curves
        ctx.beginPath()

        // Upper edge: forward
        ctx.moveTo(upper[0]!.x, upper[0]!.y)
        for (let i = 1; i < upper.length; i++) {
          const prev = upper[i - 1]!
          const curr = upper[i]!
          const cpx = (prev.x + curr.x) / 2
          const cpy = (prev.y + curr.y) / 2
          ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy)
        }
        ctx.lineTo(upper[upper.length - 1]!.x, upper[upper.length - 1]!.y)

        // Lower edge: reverse
        for (let i = lower.length - 2; i >= 0; i--) {
          const next = lower[i + 1]!
          const curr = lower[i]!
          const cpx = (next.x + curr.x) / 2
          const cpy = (next.y + curr.y) / 2
          ctx.quadraticCurveTo(next.x, next.y, cpx, cpy)
        }
        ctx.lineTo(lower[0]!.x, lower[0]!.y)

        ctx.closePath()

        // Gradient fill from source to target color
        const grad = ctx.createLinearGradient(conn.sx, conn.sy, conn.tx, conn.ty)
        grad.addColorStop(0, conn.sourceColor)
        grad.addColorStop(1, conn.targetColor)
        ctx.fillStyle = grad
        ctx.fill()

      }

      // ── Draw milestone blobs with organic deformation ──

      for (const blob of blobs) {
        // Viewport culling
        const blobPad = blob.radius + 10
        if (!isInViewport(blob.x - blobPad, blob.y - blobPad,
            blob.x + blobPad, blob.y + blobPad,
            tf.x, tf.y, tf.scale, width, height)) continue

        // Breathing radius
        const breathe = Math.sin(time * 0.5 + blob.breathePhase) * 3
        const baseR = blob.radius + breathe

        // Organic blob shape: draw with sinusoidal radius variation
        const deformA = Math.sin(time * 0.3 + blob.wobblePhase) * 3
        const deformB = Math.cos(time * 0.25 + blob.wobblePhase * 1.3) * 2
        const rotPhase = time * 0.15 + blob.phaseIndex * 0.5

        ctx.beginPath()
        for (let i = 0; i <= BLOB_STEPS; i++) {
          const angle = (i / BLOB_STEPS) * Math.PI * 2
          const r = baseR
            + deformA * Math.sin(blob.deformFreq * angle + rotPhase)
            + deformB * Math.cos((blob.deformFreq + 1) * angle - rotPhase * 0.7)
          const px = blob.x + Math.cos(angle) * r
          const py = blob.y + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fillStyle = blob.color
        ctx.fill()
      }

      // ── Draw nucleus shapes ──
      for (const blob of blobs) {
        // Viewport culling (same bounds as blob)
        const blobPad = blob.radius + 10
        if (!isInViewport(blob.x - blobPad, blob.y - blobPad,
            blob.x + blobPad, blob.y + blobPad,
            tf.x, tf.y, tf.scale, width, height)) continue

        const nucleusR = blob.radius * 0.68
        const breathe = Math.sin(time * 0.5 + blob.breathePhase) * 2.5

        // Multi-harmonic organic shape
        ctx.beginPath()
        for (let i = 0; i <= NUCLEUS_STEPS; i++) {
          const angle = (i / NUCLEUS_STEPS) * Math.PI * 2
          let r = nucleusR + breathe

          // Sum harmonics (fewer on mobile)
          const harmonicCount = Math.min(NUCLEUS_HARMONICS, blob.nucleusHarmonics.length)
          for (let h = 0; h < harmonicCount; h++) {
            const freq = h + 2  // frequencies 2, 3, 4, 5, 6
            const amp = blob.nucleusHarmonics[h]!
            const phase = blob.nucleusPhases[h]! + time * blob.nucleusRotSpeed * (h % 2 === 0 ? 1 : -0.7)
            r += amp * Math.sin(freq * angle + phase)
          }

          // Clamp so it doesn't exceed membrane
          r = Math.max(nucleusR * 0.6, Math.min(nucleusR * 1.25, r))

          const px = blob.x + Math.cos(angle) * r
          const py = blob.y + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()

        // Slightly brighter than the membrane blob
        ctx.globalAlpha = pal.nucleus
        ctx.fillStyle = blob.color
        ctx.fill()
        ctx.globalAlpha = 1
      }

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [width, height, bubbles, palette])
  // NOTE: transform removed from deps — read from ref instead

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        zIndex: 1,
        pointerEvents: 'none',
        // Skip expensive SVG goo filter on mobile — use cheaper CSS blur
        filter: IS_MOBILE ? 'blur(1px)' : 'url(#goo-filter)',
        opacity: palette.goo,
      }}
    />
  )
}
