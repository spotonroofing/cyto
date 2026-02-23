// ── Shared math utilities for goo rendering ──

import type { LayoutLink } from './useBubbleLayout'

// ── Types ──

export interface ConnectionData {
  sx: number; sy: number; sr: number
  tx: number; ty: number; tr: number
  dist: number
  sourceColor: string
  targetColor: string
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

/** Convert hex color to [r, g, b] normalized to 0-1 */
export function hexToVec3(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
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

    conns.push({
      sx, sy, sr, tx, ty, tr, dist,
      sourceColor: phaseColor(link.sourcePhaseIndex),
      targetColor: phaseColor(link.targetPhaseIndex),
    })
  }

  return conns
}
