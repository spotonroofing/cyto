// ── Shared math utilities for goo rendering ──
// Extracted from GooCanvas so both Canvas 2D (fallback) and WebGL renderers can use them.

import type { LayoutLink } from './useBubbleLayout'

// ── Types ──

export interface ConnectionData {
  sx: number; sy: number; sr: number
  tx: number; ty: number; tr: number
  dx: number; dy: number; dist: number
  ux: number; uy: number
  nx: number; ny: number
  sourceColor: string
  targetColor: string
  phaseOffset: number
  flowSpeed: number
  wobbleFreq: number
  sourceFanOut: number
  targetFanOut: number
  minX: number; minY: number; maxX: number; maxY: number
  blendedColors: [string, string, string]
  sourceEdgeFrac: number
  targetEdgeFrac: number
}

export interface BlobData {
  x: number; y: number; radius: number
  color: string
  phaseIndex: number
  breathePhase: number
  wobblePhase: number
  deformFreq: number
  nucleusBreathePhase: number
  nucleusHarmonics: number[]
  nucleusPhases: number[]
  nucleusRotSpeed: number
}

// ── Gamma-corrected color blend ──

export function blendHex(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(Math.sqrt(r1 * r1 * (1 - t) + r2 * r2 * t))
  const g = Math.round(Math.sqrt(g1 * g1 * (1 - t) + g2 * g2 * t))
  const b = Math.round(Math.sqrt(b1 * b1 * (1 - t) + b2 * b2 * t))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/** Convert hex color to [r, g, b] normalized to 0-1 */
export function hexToVec3(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

/** Gamma-corrected blend returning [r,g,b] in 0-1 */
export function blendVec3(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.sqrt(c1[0] * c1[0] * (1 - t) + c2[0] * c2[0] * t),
    Math.sqrt(c1[1] * c1[1] * (1 - t) + c2[1] * c2[1] * t),
    Math.sqrt(c1[2] * c1[2] * (1 - t) + c2[2] * c2[2] * t),
  ]
}

// ── Connection sampling ──

export function sampleConnection(
  conn: ConnectionData,
  t: number,
  time: number,
  wobbleI = 1,
  tubeWidthRatio = 0.24,
  filletRatio = 1.4,
  edgeWobbleSpeed = 1,
  edgeWobbleAmp = 1,
): { x: number; y: number; width: number } {
  const curveBow = Math.sin(t * Math.PI) * conn.dist * 0.008
  const dampEnds = Math.sin(t * Math.PI)
  const flowWave = Math.sin(time * conn.flowSpeed * edgeWobbleSpeed + t * 4 + conn.phaseOffset) * 4 * edgeWobbleAmp * dampEnds * wobbleI

  const x = conn.sx + conn.dx * t + conn.nx * (curveBow + flowWave)
  const y = conn.sy + conn.dy * t + conn.ny * (curveBow + flowWave)

  const smallerR = Math.min(conn.sr, conn.tr)
  const tubeWidth = smallerR * tubeWidthRatio
  const tSE = conn.sr / conn.dist
  const tTE = 1 - conn.tr / conn.dist
  // Meniscus peak width where tube meets cell edge — filletRatio controls how
  // pronounced the flare is (higher = wider meniscus at the junction)
  const peakWidth = tubeWidth * (1 + filletRatio)
  const nearFan = t < 0.5 ? (conn.sourceFanOut || 1) : (conn.targetFanOut || 1)
  const fanScale = nearFan > 2 ? 0.78 : 1.0

  let width: number
  if (tSE >= tTE) {
    // Cells very close or overlapping — simple sine profile
    width = peakWidth * Math.sin(t * Math.PI) * fanScale
  } else if (t <= tSE) {
    // Inside source cell — smoothstep ramp for metaball blending
    const u = tSE > 0.001 ? t / tSE : 1
    width = peakWidth * u * u * (3 - 2 * u) * fanScale
  } else if (t >= tTE) {
    // Inside target cell — mirror
    const span = 1 - tTE
    const u = span > 0.001 ? (1 - t) / span : 1
    width = peakWidth * u * u * (3 - 2 * u) * fanScale
  } else {
    // Middle section: constant tubeWidth with concave meniscus near cell edges.
    // The tube stays thin, then flares outward right at the cell boundary —
    // like how liquid curves when it touches a sphere (surface tension meniscus).
    const distFromSE = t - tSE
    const distFromTE = tTE - t
    const gap = tTE - tSE

    // Meniscus zones extend from each cell edge into the tube.
    // Depth proportional to cell radius fraction, scaled by filletRatio.
    const mzS = Math.min(tSE * filletRatio, gap * 0.4)
    const mzT = Math.min((1 - tTE) * filletRatio, gap * 0.4)

    if (distFromSE < mzS) {
      const u = distFromSE / mzS                    // 0 at cell edge, 1 at meniscus end
      const concave = (1 - u) * (1 - u)             // quadratic: stays thin, flares at edge
      width = (tubeWidth + (peakWidth - tubeWidth) * concave) * fanScale
    } else if (distFromTE < mzT) {
      const u = distFromTE / mzT
      const concave = (1 - u) * (1 - u)
      width = (tubeWidth + (peakWidth - tubeWidth) * concave) * fanScale
    } else {
      width = tubeWidth * fanScale                   // constant tube width in the middle
    }
  }

  return { x, y, width }
}

// ── Precompute connections from layout ──

export function precomputeConnections(
  links: LayoutLink[],
  phaseColor: (index: number) => string,
): ConnectionData[] {
  const conns: ConnectionData[] = []
  for (const link of links) {
    const sx = link.source.x, sy = link.source.y, sr = link.source.radius
    const tx = link.target.x, ty = link.target.y, tr = link.target.radius
    const dx = tx - sx, dy = ty - sy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) continue

    const ux = dx / dist, uy = dy / dist
    const nx = -uy, ny = ux
    const pad = Math.max(sr, tr) * 0.6

    const sourceColor = phaseColor(link.sourcePhaseIndex)
    const targetColor = phaseColor(link.targetPhaseIndex)
    const rawSourceEdge = sr / dist
    const rawTargetEdge = 1 - tr / dist

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
      minX: Math.min(sx, tx) - pad,
      minY: Math.min(sy, ty) - pad,
      maxX: Math.max(sx, tx) + pad,
      maxY: Math.max(sy, ty) + pad,
      blendedColors: [
        blendHex(sourceColor, targetColor, 0.25),
        blendHex(sourceColor, targetColor, 0.5),
        blendHex(sourceColor, targetColor, 0.75),
      ],
      sourceEdgeFrac: Math.min(rawSourceEdge, 0.4),
      targetEdgeFrac: Math.max(rawTargetEdge, 0.6),
    })
  }

  // Fan-out counts
  const endpointCount = new Map<string, number>()
  for (const conn of conns) {
    const sKey = `${conn.sx},${conn.sy}`
    const tKey = `${conn.tx},${conn.ty}`
    endpointCount.set(sKey, (endpointCount.get(sKey) || 0) + 1)
    endpointCount.set(tKey, (endpointCount.get(tKey) || 0) + 1)
  }
  for (const conn of conns) {
    conn.sourceFanOut = endpointCount.get(`${conn.sx},${conn.sy}`) || 1
    conn.targetFanOut = endpointCount.get(`${conn.tx},${conn.ty}`) || 1
  }

  return conns
}

/** Derive a stable phase offset from milestoneId for independent animation timing */
export function hashPhase(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i)
  return h * 0.37
}
