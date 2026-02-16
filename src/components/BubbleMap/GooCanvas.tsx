import { useRef, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutBubble, LayoutLink } from './useBubbleLayout'

interface GooCanvasProps {
  width: number
  height: number
  bubbles: LayoutBubble[]
  links: LayoutLink[]
  transform: { x: number; y: number; scale: number }
}

// ── Color helpers ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1)
  const [r2, g2, b2] = hexToRgb(c2)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r}, ${g}, ${b})`
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
}

interface BlobData {
  x: number; y: number; radius: number
  color: string
  phaseIndex: number
  // Per-blob animation offsets
  breathePhase: number
  wobblePhase: number
  deformFreq: number
}

// ── Sampling helpers ──────────────────────────────────────────

function sampleConnection(
  conn: ConnectionData,
  t: number, // 0..1 along path
  time: number,
): { x: number; y: number; width: number } {
  // Base position along straight line with slight organic curve
  const curveBow = Math.sin(t * Math.PI) * conn.dist * 0.04
  const flowWave = Math.sin(time * conn.flowSpeed + t * 6 + conn.phaseOffset) * 10
  const perpOffset = curveBow + flowWave * Math.sin(t * Math.PI) // damped at endpoints

  const x = conn.sx + conn.dx * t + conn.nx * perpOffset
  const y = conn.sy + conn.dy * t + conn.ny * perpOffset

  // Taper: wide at cells, narrow in middle
  // Smooth cubic falloff from endpoints
  const distFromEdge = Math.min(t, 1 - t) * 2 // 0 at edges, 1 at center
  const smallerR = Math.min(conn.sr, conn.tr)
  const endWidth = smallerR * 0.38 // width near cells
  const midWidth = Math.max(5, smallerR * 0.08) // thin in middle
  const taper = midWidth + (endWidth - midWidth) * Math.pow(1 - distFromEdge, 1.8)

  // Subtle width pulse
  const widthPulse = Math.sin(time * 0.6 + t * 4 + conn.phaseOffset) * 2.5
  const width = Math.max(3, taper + widthPulse * Math.sin(t * Math.PI))

  return { x, y, width }
}

// ── Main component ────────────────────────────────────────────

export function GooCanvas({ width, height, bubbles, links, transform }: GooCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const connectionsRef = useRef<ConnectionData[]>([])
  const blobsRef = useRef<BlobData[]>([])
  const animFrameRef = useRef<number>(0)
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

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

      conns.push({
        sx, sy, sr, tx, ty, tr,
        dx, dy, dist, ux, uy, nx, ny,
        sourceColor: getPhaseColor(link.sourcePhaseIndex, isDark),
        targetColor: getPhaseColor(link.targetPhaseIndex, isDark),
        phaseOffset: Math.random() * Math.PI * 2,
        flowSpeed: 0.4 + Math.random() * 0.3,
        wobbleFreq: 3 + Math.random() * 2,
      })
    }
    connectionsRef.current = conns

    const blobs: BlobData[] = bubbles.map((b) => ({
      x: b.x,
      y: b.y,
      radius: b.radius,
      color: getPhaseColor(b.phaseIndex, isDark),
      phaseIndex: b.phaseIndex,
      breathePhase: b.phaseIndex * 0.9 + Math.random() * 0.5,
      wobblePhase: Math.random() * Math.PI * 2,
      deformFreq: 2 + Math.random(),
    }))
    blobsRef.current = blobs
  }, [links, bubbles, isDark])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0 || height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // Detect mobile for perf scaling
    const isMobile = width < 768
    const SAMPLES_PER_100PX = isMobile ? 6 : 10

    let time = 0
    let lastFrameTime = 0
    const TARGET_DT = isMobile ? 1000 / 30 : 1000 / 60 // 30fps mobile, 60fps desktop

    const draw = (timestamp: number) => {
      // Frame rate limiting for mobile
      if (timestamp - lastFrameTime < TARGET_DT * 0.8) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrameTime = timestamp
      time += 0.016

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.translate(transform.x, transform.y)
      ctx.scale(transform.scale, transform.scale)

      const connections = connectionsRef.current
      const blobs = blobsRef.current

      // ── Draw connections as thick tapered filled paths ──

      for (const conn of connections) {
        const segments = Math.max(12, Math.floor(conn.dist / 100 * SAMPLES_PER_100PX))

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

        // Add flowing "cytoplasm particles" along the path for extra life
        const particleCount = isMobile ? 3 : 5
        for (let p = 0; p < particleCount; p++) {
          // Particle flows along the path over time
          const baseT = ((time * 0.15 * conn.flowSpeed + p / particleCount + conn.phaseOffset) % 1)
          const t = baseT
          if (t < 0.05 || t > 0.95) continue // skip near endpoints

          const sample = sampleConnection(conn, t, time)
          const particleR = sample.width * 0.4 + Math.sin(time * 1.2 + p * 2) * 1.5
          const color = lerpColor(conn.sourceColor, conn.targetColor, t)

          ctx.beginPath()
          ctx.arc(sample.x, sample.y, Math.max(2, particleR), 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = 0.6
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }

      // ── Draw milestone blobs with organic deformation ──

      for (const blob of blobs) {
        // Breathing radius
        const breathe = Math.sin(time * 0.5 + blob.breathePhase) * 3
        const baseR = blob.radius + breathe

        // Organic blob shape: draw with sinusoidal radius variation
        const deformA = Math.sin(time * 0.3 + blob.wobblePhase) * 3
        const deformB = Math.cos(time * 0.25 + blob.wobblePhase * 1.3) * 2
        const rotPhase = time * 0.15 + blob.phaseIndex * 0.5

        ctx.beginPath()
        const steps = 48
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2
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

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [width, height, transform, bubbles, isDark])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        zIndex: 1,
        pointerEvents: 'none',
        filter: 'url(#goo-filter)',
        opacity: 0.32,
      }}
    />
  )
}
