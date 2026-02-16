import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutLink, LayoutBubble } from './useBubbleLayout'

interface ConnectionLinesProps {
  links: LayoutLink[]
  bubbles: LayoutBubble[]
}

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
  const maxDist = r1 + r2 + 500
  let u1 = 0, u2 = 0

  if (r1 === 0 || r2 === 0 || d > maxDist || d <= Math.abs(r1 - r2)) return ''

  if (d < r1 + r2) {
    u1 = Math.acos((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))
    u2 = Math.acos((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d))
  }

  const abc = vecAngle(c2, c1)
  const maxSpread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)))

  const a1 = abc + u1 + (maxSpread - u1) * v
  const a2 = abc - u1 - (maxSpread - u1) * v
  const a3 = abc + Math.PI - u2 - (Math.PI - u2 - maxSpread) * v
  const a4 = abc - Math.PI + u2 + (Math.PI - u2 - maxSpread) * v

  const p1 = getVec(c1, a1, r1), p2 = getVec(c1, a2, r1)
  const p3 = getVec(c2, a3, r2), p4 = getVec(c2, a4, r2)

  const tr = r1 + r2
  const d2b = Math.min(v * handleSize, vecDist(p1, p3) / tr)
  // CLAMP minimum handle factor to 0.5 — prevents thin spider-web connectors
  const d2 = Math.max(d2b * Math.min(1, (d * 2) / tr), 0.5)
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

      {/* DRAW ORDER MATTERS: goo paths FIRST, then membrane circles ON TOP to cover junction seams */}

      {/* GOO CONNECTORS — thicker, higher opacity */}
      {links.map((link, i) => {
        const c1: [number, number] = [link.source.x, link.source.y]
        const c2: [number, number] = [link.target.x, link.target.y]

        // Use v=0.8, handleSize=5.0 for thick organic goo
        const pathD = metaballPath(
          link.source.radius, link.target.radius,
          c1, c2, 5.0, 0.8,
        )
        if (!pathD) return null

        return (
          <path
            key={`goo-${i}`}
            d={pathD}
            fill={`url(#cg-${i})`}
            fillOpacity={0.35}
            stroke="none"
          />
        )
      })}

      {/* OUTER MEMBRANE CIRCLES — drawn ON TOP of goo to cover fork junction seams */}
      {bubbles.map((bubble) => {
        const memR = bubble.radius
        const breatheMin = memR - 1
        const breatheMax = memR + 1
        const dur = 5 + (bubble.phaseIndex * 0.5)
        const isLocked = bubble.status === 'blocked' || bubble.status === 'not_started'
        return (
          <g key={`membrane-group-${bubble.milestoneId}`}>
            <circle
              cx={bubble.x}
              cy={bubble.y}
              r={memR}
              fill={getPhaseColor(bubble.phaseIndex, isDark)}
              fillOpacity={0.22}
            >
              <animate
                attributeName="r"
                values={`${memR};${breatheMax};${memR};${breatheMin};${memR}`}
                dur={`${dur}s`}
                repeatCount="indefinite"
              />
            </circle>

            {/* Dashed ring for locked phases — "membrane not fully formed" */}
            {isLocked && (
              <circle
                cx={bubble.x}
                cy={bubble.y}
                r={memR + 2}
                fill="none"
                stroke={getPhaseColor(bubble.phaseIndex, isDark)}
                strokeWidth={1}
                strokeOpacity={0.3}
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="r"
                  values={`${memR + 2};${breatheMax + 2};${memR + 2};${breatheMin + 2};${memR + 2}`}
                  dur={`${dur}s`}
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        )
      })}
    </>
  )
}
