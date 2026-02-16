import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutLink, LayoutBubble } from './useBubbleLayout'

interface ConnectionLinesProps {
  links: LayoutLink[]
  bubbles: LayoutBubble[]
}

// --- Metaball math (Hiroyuki Sato / Paper.js) ---

function vecDist(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

function vecAngle(a: [number, number], b: [number, number]): number {
  return Math.atan2(a[1] - b[1], a[0] - b[0])
}

function getVec(center: [number, number], ang: number, r: number): [number, number] {
  return [center[0] + Math.cos(ang) * r, center[1] + Math.sin(ang) * r]
}

function metaballPath(
  r1: number, r2: number,
  c1: [number, number], c2: [number, number],
  handleSize: number, v: number,
): string {
  const HALF_PI = Math.PI / 2
  const d = vecDist(c1, c2)
  const maxDist = r1 + r2 + 400
  let u1 = 0, u2 = 0

  if (r1 === 0 || r2 === 0 || d > maxDist || d <= Math.abs(r1 - r2)) return ''

  if (d < r1 + r2) {
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d))
  }

  const abc = vecAngle(c2, c1)
  const maxSpread = Math.acos((r1 - r2) / d)

  const a1 = abc + u1 + (maxSpread - u1) * v
  const a2 = abc - u1 - (maxSpread - u1) * v
  const a3 = abc + Math.PI - u2 - (Math.PI - u2 - maxSpread) * v
  const a4 = abc - Math.PI + u2 + (Math.PI - u2 - maxSpread) * v

  const p1 = getVec(c1, a1, r1), p2 = getVec(c1, a2, r1)
  const p3 = getVec(c2, a3, r2), p4 = getVec(c2, a4, r2)

  const tr = r1 + r2
  const d2b = Math.min(v * handleSize, vecDist(p1, p3) / tr)
  const d2 = d2b * Math.min(1, (d * 2) / tr)
  const hr1 = r1 * d2, hr2 = r2 * d2

  const h1 = getVec(p1, a1 - HALF_PI, hr1)
  const h2 = getVec(p2, a2 + HALF_PI, hr1)
  const h3 = getVec(p3, a3 + HALF_PI, hr2)
  const h4 = getVec(p4, a4 - HALF_PI, hr2)

  const escaped = d > r1

  return [
    'M', `${p1[0]},${p1[1]}`,
    'C', `${h1[0]},${h1[1]}`, `${h3[0]},${h3[1]}`, `${p3[0]},${p3[1]}`,
    'A', r2, r2, 0, escaped ? 1 : 0, 0, `${p4[0]},${p4[1]}`,
    'C', `${h4[0]},${h4[1]}`, `${h2[0]},${h2[1]}`, `${p2[0]},${p2[1]}`,
    'Z',
  ].join(' ')
}

export function ConnectionLines({ links, bubbles }: ConnectionLinesProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  // Build a set of milestones that have connections (for outer membrane rendering)
  const connectedMilestones = new Set<string>()
  for (const link of links) {
    connectedMilestones.add(link.source.milestoneId)
    connectedMilestones.add(link.target.milestoneId)
  }

  return (
    <>
      <defs>
        {links.map((link, i) => {
          const sc = getPhaseColor(link.sourcePhaseIndex, isDark)
          const tc = getPhaseColor(link.targetPhaseIndex, isDark)
          return (
            <linearGradient
              key={`cg-${i}`}
              id={`cg-${i}`}
              x1={link.source.x} y1={link.source.y}
              x2={link.target.x} y2={link.target.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={sc} />
              <stop offset="100%" stopColor={tc} />
            </linearGradient>
          )
        })}
      </defs>

      {/* OUTER MEMBRANE: full circles for each milestone (lighter, larger) */}
      {bubbles.filter(b => connectedMilestones.has(b.milestoneId)).map((bubble) => (
        <circle
          key={`membrane-${bubble.milestoneId}`}
          cx={bubble.x}
          cy={bubble.y}
          r={bubble.radius}
          fill={getPhaseColor(bubble.phaseIndex, isDark)}
          fillOpacity={bubble.status === 'blocked' || bubble.status === 'not_started' ? 0.1 : 0.2}
        />
      ))}

      {/* GOO CONNECTORS: metaball membrane paths between milestones */}
      {links.map((link, i) => {
        const isBlocked = link.targetStatus === 'blocked' || link.targetStatus === 'not_started'
        const opacity = isBlocked ? 0.08 : 0.2

        const c1: [number, number] = [link.source.x, link.source.y]
        const c2: [number, number] = [link.target.x, link.target.y]

        // Use larger radii for the metaball to create thicker goo
        const gooR1 = link.source.radius * 1.0
        const gooR2 = link.target.radius * 1.0

        const pathD = metaballPath(gooR1, gooR2, c1, c2, 3.5, 0.65)
        if (!pathD) return null

        return (
          <path
            key={`goo-${i}`}
            d={pathD}
            fill={`url(#cg-${i})`}
            fillOpacity={opacity}
            stroke="none"
          />
        )
      })}
    </>
  )
}
