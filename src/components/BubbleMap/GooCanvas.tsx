import { useRef, useEffect, useLayoutEffect } from 'react'
import { useTheme } from '@/themes'
import { Q } from '@/utils/performanceTier'
import { useDebugStore } from '@/stores/debugStore'
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
  // Precomputed gradient blend stops for smooth color transitions
  blendedColors: [string, string, string]
  // Fraction of gradient covered by source/target cell radii (for edge-aligned stops)
  sourceEdgeFrac: number
  targetEdgeFrac: number
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
  nucleusBreathePhase: number // independent breathing phase (decoupled from membrane)
  nucleusHarmonics: number[]  // 4-6 random amplitudes for multi-harmonic shape
  nucleusPhases: number[]     // matching phase offsets
  nucleusRotSpeed: number     // rotation speed
}

// ── Sampling helpers ──────────────────────────────────────────

function sampleConnection(
  conn: ConnectionData,
  t: number, // 0..1 along path
  time: number,
  wobbleI = 1,
): { x: number; y: number; width: number } {
  // Gentle organic curve bow
  const curveBow = Math.sin(t * Math.PI) * conn.dist * 0.008
  // Flow wave, damped at endpoints for clean junction merge
  const dampEnds = Math.sin(t * Math.PI)  // 0 at edges, 1 at center
  const flowWave = Math.sin(time * conn.flowSpeed + t * 4 + conn.phaseOffset) * 4 * dampEnds * wobbleI

  const x = conn.sx + conn.dx * t + conn.nx * (curveBow + flowWave)
  const y = conn.sy + conn.dy * t + conn.ny * (curveBow + flowWave)

  // ── Width: organic fillet at cell junctions ──
  const smallerR = Math.min(conn.sr, conn.tr)

  // Tube half-width in mid-section
  const tubeWidth = smallerR * 0.24

  // Cell edge positions in t-space
  const tSE = conn.sr / conn.dist  // source cell edge
  const tTE = 1 - conn.tr / conn.dist  // target cell edge

  // Fillet: wider than tube at cell edge for smooth goo merge.
  // Zero at cell centers to prevent asymmetric goo offset.
  const filletWidth = tubeWidth * 1.4

  // Fan-out scaling for branching nodes
  const nearFan = t < 0.5 ? (conn.sourceFanOut || 1) : (conn.targetFanOut || 1)
  const fanScale = nearFan > 2 ? 0.78 : 1.0

  let width: number

  if (tSE >= tTE) {
    // Cells overlap or touch — bell-curve profile
    width = filletWidth * Math.sin(t * Math.PI) * fanScale
  } else if (t <= tSE) {
    // Inside source cell: smoothstep 0 → filletWidth (thin at center, wide at edge)
    const u = tSE > 0.001 ? t / tSE : 1
    width = filletWidth * u * u * (3 - 2 * u) * fanScale
  } else if (t >= tTE) {
    // Inside target cell: smoothstep filletWidth → 0 (wide at edge, thin at center)
    const span = 1 - tTE
    const u = span > 0.001 ? (1 - t) / span : 1
    width = filletWidth * u * u * (3 - 2 * u) * fanScale
  } else {
    // Between cells: smooth fillet → tube → fillet transition
    const gap = tTE - tSE
    const g = (t - tSE) / gap  // 0 at source edge, 1 at target edge
    const edgeDist = Math.min(g, 1 - g)  // 0 at edges, 0.5 at center
    const transZone = 0.3  // transition over first/last 30% of gap
    const fade = Math.min(edgeDist / transZone, 1)
    const eased = 0.5 * (1 - Math.cos(Math.PI * fade))
    width = (filletWidth + (tubeWidth - filletWidth) * eased) * fanScale
  }

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
  // Padding scales with zoom to account for goo filter bleed (stdDev scales linearly)
  const pad = Math.max(60, 40 * scale)
  return screenMaxX >= -pad && screenMinX <= viewW + pad &&
         screenMaxY >= -pad && screenMinY <= viewH + pad
}

// ── Gamma-corrected color blend for perceptually smooth gradients ──

function blendHex(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)
  // Blend in squared (gamma) space for perceptual smoothness
  const r = Math.round(Math.sqrt(r1 * r1 * (1 - t) + r2 * r2 * t))
  const g = Math.round(Math.sqrt(g1 * g1 * (1 - t) + g2 * g2 * t))
  const b = Math.round(Math.sqrt(b1 * b1 * (1 - t) + b2 * b2 * t))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ── Extracted shape drawing ──────────────────────────────────
// Draws connections, blobs, and nuclei to the given context.
// When cull is null, all shapes are drawn (for offscreen cache).
// When cull is provided, viewport culling is applied (for fallback direct draw).

function renderShapes(
  ctx: CanvasRenderingContext2D,
  connections: ConnectionData[],
  blobs: BlobData[],
  time: number,
  nucleusAlpha: number,
  cull: { tx: number; ty: number; scale: number; viewW: number; viewH: number } | null,
  wobbleI = 1,
  nucleusAnimate = true,
  useGradients = true,
) {
  const SAMPLES_PER_100PX = Q.gooSamplesPerPx
  const MIN_SEGMENTS = Q.gooMinSegments
  const BLOB_STEPS = Q.gooBlobSteps
  const NUCLEUS_STEPS = Q.gooNucleusSteps
  const NUCLEUS_HARMONICS = Q.gooNucleusHarmonics

  // ── Draw connections as thick tapered filled paths ──

  for (const conn of connections) {
    // Viewport culling (skip when rendering to full-world offscreen cache)
    if (cull && !isInViewport(conn.minX, conn.minY, conn.maxX, conn.maxY,
        cull.tx, cull.ty, cull.scale, cull.viewW, cull.viewH)) continue

    const segments = Math.max(MIN_SEGMENTS, Math.floor(conn.dist / 100 * SAMPLES_PER_100PX))

    // Sample points along the connection
    const points: { x: number; y: number; width: number }[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      points.push(sampleConnection(conn, t, time, wobbleI))
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
      // Edge wobble — independent sine-wave displacement per edge for organic ripple
      let wU: number, wL: number
      if (Q.gooEdgeWobble) {
        const edgeT = i / segments
        const wDamp = Math.sin(edgeT * Math.PI)
        const wobbleUpper = (
          Math.sin(time * 3.2 + edgeT * 6 + conn.phaseOffset) * 2.5
          + Math.sin(time * 2.1 + edgeT * 3.5 + conn.phaseOffset * 1.7) * 1.5
        ) * wDamp
        const wobbleLower = (
          Math.sin(time * 2.8 + edgeT * 5.5 + conn.phaseOffset + 2.1) * 2.5
          + Math.sin(time * 2.3 + edgeT * 3 + conn.phaseOffset * 1.3 + 1.0) * 1.5
        ) * wDamp
        wU = p.width + wobbleUpper * wobbleI
        wL = p.width + wobbleLower * wobbleI
      } else {
        wU = p.width
        wL = p.width
      }
      upper.push({ x: p.x + lnx * wU, y: p.y + lny * wU })
      lower.push({ x: p.x - lnx * wL, y: p.y - lny * wL })
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

    // Smooth gradient — edge-aligned so pure colors extend through cell radii
    // and the visible transition only occurs in the gap between cell edges
    if (useGradients) {
      const grad = ctx.createLinearGradient(conn.sx, conn.sy, conn.tx, conn.ty)
      const s = conn.sourceEdgeFrac
      const e = conn.targetEdgeFrac
      const range = e - s
      grad.addColorStop(0, conn.sourceColor)
      grad.addColorStop(s, conn.sourceColor)
      grad.addColorStop(s + range * 0.25, conn.blendedColors[0]!)
      grad.addColorStop(s + range * 0.5, conn.blendedColors[1]!)
      grad.addColorStop(s + range * 0.75, conn.blendedColors[2]!)
      grad.addColorStop(e, conn.targetColor)
      grad.addColorStop(1, conn.targetColor)
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = conn.blendedColors[1]!
    }
    ctx.fill()
  }

  // ── Draw milestone blobs with organic deformation ──

  for (const blob of blobs) {
    if (cull) {
      const blobPad = blob.radius + 10
      if (!isInViewport(blob.x - blobPad, blob.y - blobPad,
          blob.x + blobPad, blob.y + blobPad,
          cull.tx, cull.ty, cull.scale, cull.viewW, cull.viewH)) continue
    }

    // Breathing radius
    const breathe = Math.sin(time * 0.5 + blob.breathePhase) * 3.6 * wobbleI
    const baseR = blob.radius + breathe

    // Organic blob shape: draw with sinusoidal radius variation
    const deformA = Math.sin(time * 0.3 + blob.wobblePhase) * 3.6 * wobbleI
    const deformB = Math.cos(time * 0.25 + blob.wobblePhase * 1.3) * 2.4 * wobbleI
    const rotPhase = time * -0.15 + blob.phaseIndex * 0.5

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
    if (cull) {
      const blobPad = blob.radius + 10
      if (!isInViewport(blob.x - blobPad, blob.y - blobPad,
          blob.x + blobPad, blob.y + blobPad,
          cull.tx, cull.ty, cull.scale, cull.viewW, cull.viewH)) continue
    }

    const nucleusR = blob.radius * 0.782

    ctx.beginPath()
    if (nucleusAnimate) {
      const breathe = Math.sin(time * 0.7 + blob.nucleusBreathePhase) * 2.5

      // Multi-harmonic organic shape
      for (let i = 0; i <= NUCLEUS_STEPS; i++) {
        const angle = (i / NUCLEUS_STEPS) * Math.PI * 2
        let r = nucleusR + breathe

        // Sum harmonics (fewer on mobile)
        const harmonicCount = Math.min(NUCLEUS_HARMONICS, blob.nucleusHarmonics.length)
        for (let h = 0; h < harmonicCount; h++) {
          const freq = h + 2  // frequencies 2, 3, 4, 5, 6
          const amp = blob.nucleusHarmonics[h]!
          const phase = blob.nucleusPhases[h]! + time * blob.nucleusRotSpeed * (h % 2 === 0 ? -1 : 0.7)
          r += amp * Math.sin(freq * angle + phase)
        }

        // Clamp so it doesn't exceed membrane
        r = Math.max(nucleusR * 0.6, Math.min(nucleusR * 1.25, r))

        const px = blob.x + Math.cos(angle) * r
        const py = blob.y + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
    } else {
      // Static circle when nucleus wobble is disabled
      ctx.arc(blob.x, blob.y, nucleusR, 0, Math.PI * 2)
    }
    ctx.closePath()

    // Slightly brighter than the membrane blob
    ctx.globalAlpha = nucleusAlpha
    ctx.fillStyle = blob.color
    ctx.fill()
    ctx.globalAlpha = 1
  }
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

  // Ref for the dedicated cache SVG filter's blur element
  const cacheBlurRef = useRef<SVGFEGaussianBlurElement>(null)

  // Refs for layout-sync: allow useLayoutEffect to position canvas in sync with SVG
  const worldBoundsRef = useRef<{ wMinX: number; wMinY: number } | null>(null)
  const useCacheRef = useRef(false)

  // Keep refs in sync without restarting animation loop.
  // Transform uses inline assignment (not useEffect) to eliminate 1-frame lag
  // between SVG overlay and canvas during panning.
  transformRef.current = transform
  useEffect(() => { paletteRef.current = palette }, [palette])

  // Sync canvas CSS transform with React's DOM commit to eliminate mobile pan lag.
  // On the fallback path (mobile), CSS transform positions the world-space canvas.
  // Without this, the draw loop's rAF updates CSS transform 1+ frames after React
  // updates the SVG overlay, causing the goo to visibly drag behind cells.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const wb = worldBoundsRef.current
    if (!canvas || !wb || useCacheRef.current) return
    canvas.style.transform = `translate(${wb.wMinX * transform.scale + transform.x}px, ${wb.wMinY * transform.scale + transform.y}px) scale(${transform.scale})`
  }, [transform])

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

      const sourceColor = phaseColor(link.sourcePhaseIndex)
      const targetColor = phaseColor(link.targetPhaseIndex)

      // Fraction of gradient hidden under each cell — the gradient should stay
      // at pure source/target color through these zones so no "hint" of the
      // other color appears at the cell membrane edge.
      const rawSourceEdge = sr / dist
      const rawTargetEdge = 1 - tr / dist
      // Clamp so the visible transition zone is at least 20% of the gradient
      const sourceEdgeFrac = Math.min(rawSourceEdge, 0.4)
      const targetEdgeFrac = Math.max(rawTargetEdge, 0.6)

      conns.push({
        sx, sy, sr, tx, ty, tr,
        dx, dy, dist, ux, uy, nx, ny,
        sourceColor,
        targetColor,
        phaseOffset: Math.random() * Math.PI * 2,
        flowSpeed: 0.4 + Math.random() * 0.3,
        wobbleFreq: 3 + Math.random() * 2,
        sourceFanOut: 1,
        targetFanOut: 1,
        minX, minY, maxX, maxY,
        blendedColors: [
          blendHex(sourceColor, targetColor, 0.25),
          blendHex(sourceColor, targetColor, 0.5),
          blendHex(sourceColor, targetColor, 0.75),
        ],
        sourceEdgeFrac,
        targetEdgeFrac,
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
      nucleusBreathePhase: Math.random() * Math.PI * 2,  // independent from membrane breathePhase
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

    const dpr = Math.min(window.devicePixelRatio || 1, Q.canvasDpr)

    // ── Detect ctx.filter support for offscreen caching ──
    let useCache = false
    try {
      ctx.filter = 'url(#goo-cache)'
      useCache = ctx.filter !== 'none' && ctx.filter !== ''
      ctx.filter = 'none'
    } catch { useCache = false }
    useCacheRef.current = useCache

    // ── Compute world-space bounding box for offscreen cache ──
    const PAD = 60 // padding for blur bleed + wobble amplitude
    let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity
    for (const b of blobsRef.current) {
      wMinX = Math.min(wMinX, b.x - b.radius - PAD)
      wMaxX = Math.max(wMaxX, b.x + b.radius + PAD)
      wMinY = Math.min(wMinY, b.y - b.radius - PAD)
      wMaxY = Math.max(wMaxY, b.y + b.radius + PAD)
    }
    for (const c of connectionsRef.current) {
      wMinX = Math.min(wMinX, c.minX - 20)
      wMaxX = Math.max(wMaxX, c.maxX + 20)
      wMinY = Math.min(wMinY, c.minY - 20)
      wMaxY = Math.max(wMaxY, c.maxY + 20)
    }
    const worldW = wMaxX - wMinX
    const worldH = wMaxY - wMinY
    worldBoundsRef.current = { wMinX, wMinY }

    // ── Canvas sizing (depends on rendering path) ──
    if (useCache) {
      // Desktop: viewport-sized canvas, offscreen cache handles goo filter
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.style.filter = 'none'
      canvas.style.transform = ''
      canvas.style.transformOrigin = ''
    } else {
      // Fallback: world-sized canvas with CSS goo filter + CSS transform for camera.
      // Filter operates in world space (same as desktop offscreen cache), preserving
      // all wobble/taper detail. CSS transform handles pan/zoom with zero lag.
      const fbW = Math.max(1, worldW)
      const fbH = Math.max(1, worldH)
      canvas.width = Math.max(1, Math.ceil(fbW * dpr))
      canvas.height = Math.max(1, Math.ceil(fbH * dpr))
      canvas.style.width = `${fbW}px`
      canvas.style.height = `${fbH}px`
      canvas.style.transformOrigin = '0 0'
      canvas.style.filter = 'url(#goo-cache)'
      if (cacheBlurRef.current) {
        cacheBlurRef.current.setAttribute('stdDeviation', String(Q.baseBlurStdDev))
      }
    }

    // ── Offscreen canvas setup (cached path only) ──
    const CACHE_QUALITY = Q.gooCacheQuality
    const CACHE_INTERVAL = Q.gooCacheInterval
    let shapeCanvas: HTMLCanvasElement | null = null
    let shapeCtx: CanvasRenderingContext2D | null = null
    let filteredCanvas: HTMLCanvasElement | null = null
    let filteredCtx: CanvasRenderingContext2D | null = null
    let cacheW = 0, cacheH = 0
    let cacheScale = transformRef.current.scale

    function initCache(_scale: number) {
      cacheScale = _scale
      cacheW = Math.max(1, Math.ceil(worldW * CACHE_QUALITY))
      cacheH = Math.max(1, Math.ceil(worldH * CACHE_QUALITY))
      if (!shapeCanvas) {
        shapeCanvas = document.createElement('canvas')
        filteredCanvas = document.createElement('canvas')
      }
      shapeCanvas.width = cacheW
      shapeCanvas.height = cacheH
      filteredCanvas!.width = cacheW
      filteredCanvas!.height = cacheH
      shapeCtx = shapeCanvas.getContext('2d')
      filteredCtx = filteredCanvas!.getContext('2d')
    }

    if (useCache && worldW > 0 && worldH > 0) {
      initCache(transformRef.current.scale)
    }

    let frameCount = 0
    let needsCacheUpdate = true
    let time = 0
    let lastFrameTime = 0
    const TARGET_DT = Q.gooTargetDt
    const IDLE_DT = Q.gooIdleDt
    const IDLE_THRESHOLD = 2000 // ms of no transform change before entering idle
    let lastKnownTf = { x: 0, y: 0, scale: 0 }
    let lastTransformChangeTime = performance.now()
    let lastGooFilter = true
    let lastFallbackFilter = useCache ? '' : 'url(#goo-cache)'

    const draw = (timestamp: number) => {
      const dbg = useDebugStore.getState()

      // Track transform changes for idle detection
      const tf = transformRef.current
      if (tf.x !== lastKnownTf.x || tf.y !== lastKnownTf.y || tf.scale !== lastKnownTf.scale) {
        lastKnownTf = { x: tf.x, y: tf.y, scale: tf.scale }
        lastTransformChangeTime = timestamp
      }

      const isIdle = (timestamp - lastTransformChangeTime) > IDLE_THRESHOLD
      // FPS cap override: when set, overrides component default
      const effectiveDT = dbg.fpsCap > 0
        ? 1000 / dbg.fpsCap
        : (isIdle ? IDLE_DT : TARGET_DT)

      // Frame rate limiting (adaptive: slower when idle)
      if (timestamp - lastFrameTime < effectiveDT * 0.8) {
        animFrameRef.current = requestAnimationFrame(draw)
        return
      }
      const prevFrame = lastFrameTime
      lastFrameTime = timestamp
      // Use real elapsed time so wobble speed is independent of frame rate
      time += prevFrame > 0 ? Math.min((timestamp - prevFrame) / 1000, 0.1) : 0.016

      const pal = paletteRef.current
      const connections = connectionsRef.current
      const blobs = blobsRef.current
      const wobbleI = dbg.gooWobble ? dbg.gooWobbleIntensity : 0

      // Force cache update when gooFilter toggle changes
      if (dbg.gooFilter !== lastGooFilter) {
        needsCacheUpdate = true
        lastGooFilter = dbg.gooFilter
      }

      if (useCache && shapeCtx && filteredCtx && shapeCanvas && filteredCanvas) {
        // ── Cached rendering path ──
        frameCount++

        // Check if zoom changed significantly (>20%) — re-render cache at new resolution
        const zoomDelta = Math.abs(tf.scale - cacheScale) / Math.max(cacheScale, 0.01)
        if (zoomDelta > 0.2) {
          initCache(tf.scale)
          needsCacheUpdate = true
        }

        // Update cache on wobble ticks (every N frames)
        if (needsCacheUpdate || frameCount % CACHE_INTERVAL === 0) {
          needsCacheUpdate = false

          // Update goo-cache filter stdDeviation for offscreen resolution
          if (cacheBlurRef.current) {
            const stdDev = Q.baseBlurStdDev * CACHE_QUALITY * dbg.filterBlurRadius
            cacheBlurRef.current.setAttribute('stdDeviation', String(stdDev))
          }

          // 1. Draw raw shapes to shape canvas — CLEAR FIRST
          shapeCtx.clearRect(0, 0, cacheW, cacheH)
          shapeCtx.save()
          shapeCtx.scale(CACHE_QUALITY, CACHE_QUALITY)
          shapeCtx.translate(-wMinX, -wMinY)
          renderShapes(shapeCtx, connections, blobs, time, pal.nucleus, null,
            wobbleI, dbg.nucleusWobble, dbg.connectionGradients)
          shapeCtx.restore()

          // 2. Apply goo filter to cache (skip when gooFilter is OFF)
          filteredCtx.clearRect(0, 0, cacheW, cacheH)
          if (dbg.gooFilter) {
            filteredCtx.filter = 'url(#goo-cache)'
            filteredCtx.drawImage(shapeCanvas, 0, 0)
            filteredCtx.filter = 'none'
          } else {
            filteredCtx.drawImage(shapeCanvas, 0, 0)
          }
        }

        // 3. Composite cached result to main canvas — CLEAR FIRST
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.scale(dpr, dpr)
        ctx.translate(tf.x, tf.y)
        ctx.scale(tf.scale, tf.scale)
        // Draw filtered cache at world position, scaling from cache coords to world coords
        ctx.drawImage(filteredCanvas, 0, 0, cacheW, cacheH, wMinX, wMinY, worldW, worldH)
        ctx.restore()
      } else {
        // ── Fallback: world-space draw with CSS filter + CSS transform ──
        // Shapes drawn in world space so the CSS filter processes at world resolution
        // (identical to desktop offscreen cache). CSS transform handles camera.
        if (cacheBlurRef.current) {
          const stdDev = Q.baseBlurStdDev * CACHE_QUALITY * dbg.filterBlurRadius
          cacheBlurRef.current.setAttribute('stdDeviation', String(stdDev))
        }

        const desiredFilter = dbg.gooFilter ? 'url(#goo-cache)' : 'none'
        if (desiredFilter !== lastFallbackFilter) {
          canvas.style.filter = desiredFilter
          lastFallbackFilter = desiredFilter
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.scale(dpr, dpr)
        ctx.translate(-wMinX, -wMinY)
        renderShapes(ctx, connections, blobs, time, pal.nucleus, null,
          wobbleI, dbg.nucleusWobble, dbg.connectionGradients)
        ctx.restore()

        // Position via CSS transform — pan/zoom is instant, no re-filtering
        canvas.style.transform = `translate(${wMinX * tf.scale + tf.x}px, ${wMinY * tf.scale + tf.y}px) scale(${tf.scale})`
      }

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [width, height, bubbles, palette])
  // NOTE: transform removed from deps — read from ref instead

  // Unified color matrix — same goo strength on all devices
  const cmValues = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8'

  return (
    <>
      {/* Hidden SVG with dedicated goo filter for offscreen cache rendering.
          Separate from BubbleMap's filters so we can control stdDeviation independently. */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="goo-cache" colorInterpolationFilters="sRGB">
            <feGaussianBlur
              ref={cacheBlurRef}
              in="SourceGraphic"
              stdDeviation="12"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              type="matrix"
              values={cmValues}
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          zIndex: 1,
          pointerEvents: 'none',
          // CSS filter/transform set dynamically in the animation loop
          opacity: palette.goo,
        }}
      />
    </>
  )
}
