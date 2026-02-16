import { useSettingsStore } from '@/stores/settingsStore'
import { getPhaseColor } from '@/styles/theme'
import type { LayoutLink } from './useBubbleLayout'

interface ConnectionLinesProps {
  links: LayoutLink[]
}

// --- Metaball math (Hiroyuki Sato / Paper.js) ---

function dist(a: [number, number], b: [number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

function angle(a: [number, number], b: [number, number]): number {
  return Math.atan2(a[1] - b[1], a[0] - b[0])
}

function getVector(center: [number, number], ang: number, r: number): [number, number] {
  return [center[0] + Math.cos(ang) * r, center[1] + Math.sin(ang) * r]
}

function metaball(
  radius1: number,
  radius2: number,
  center1: [number, number],
  center2: [number, number],
  handleSize = 2.4,
  v = 0.5,
): string {
  const HALF_PI = Math.PI / 2
  const d = dist(center1, center2)
  const maxDist = radius1 + radius2 + 350
  let u1: number, u2: number

  if (
    radius1 === 0 || radius2 === 0 ||
    d > maxDist ||
    d <= Math.abs(radius1 - radius2)
  ) {
    return ''
  }

  if (d < radius1 + radius2) {
    u1 = Math.acos((radius1 * radius1 + d * d - radius2 * radius2) / (2 * radius1 * d))
    u2 = Math.acos((radius2 * radius2 + d * d - radius1 * radius1) / (2 * radius2 * d))
  } else {
    u1 = 0
    u2 = 0
  }

  const angleBetweenCenters = angle(center2, center1)
  const maxSpread = Math.acos((radius1 - radius2) / d)

  const angle1 = angleBetweenCenters + u1 + (maxSpread - u1) * v
  const angle2 = angleBetweenCenters - u1 - (maxSpread - u1) * v
  const angle3 = angleBetweenCenters + Math.PI - u2 - (Math.PI - u2 - maxSpread) * v
  const angle4 = angleBetweenCenters - Math.PI + u2 + (Math.PI - u2 - maxSpread) * v

  const p1 = getVector(center1, angle1, radius1)
  const p2 = getVector(center1, angle2, radius1)
  const p3 = getVector(center2, angle3, radius2)
  const p4 = getVector(center2, angle4, radius2)

  const totalRadius = radius1 + radius2
  const d2Base = Math.min(v * handleSize, dist(p1, p3) / totalRadius)
  const d2 = d2Base * Math.min(1, (d * 2) / totalRadius)

  const r1 = radius1 * d2
  const r2 = radius2 * d2

  const h1 = getVector(p1, angle1 - HALF_PI, r1)
  const h2 = getVector(p2, angle2 + HALF_PI, r1)
  const h3 = getVector(p3, angle3 + HALF_PI, r2)
  const h4 = getVector(p4, angle4 - HALF_PI, r2)

  const escaped = d > radius1

  return [
    'M', p1.join(','),
    'C', h1.join(','), h3.join(','), p3.join(','),
    'A', radius2, radius2, 0, escaped ? 1 : 0, 0, p4.join(','),
    'C', h4.join(','), h2.join(','), p2.join(','),
    'Z',
  ].join(' ')
}

// --- Component ---

export function ConnectionLines({ links }: ConnectionLinesProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'

  return (
    <>
      <defs>
        {links.map((link, i) => {
          const sourceColor = getPhaseColor(link.sourcePhaseIndex, isDark)
          const targetColor = getPhaseColor(link.targetPhaseIndex, isDark)
          return (
            <linearGradient
              key={`grad-${i}`}
              id={`connection-grad-${i}`}
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={sourceColor} stopOpacity={0.6} />
              <stop offset="50%" stopColor={sourceColor} stopOpacity={0.35} />
              <stop offset="50%" stopColor={targetColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={targetColor} stopOpacity={0.6} />
            </linearGradient>
          )
        })}
      </defs>

      {links.map((link, i) => {
        const isBlocked = link.targetStatus === 'blocked' || link.targetStatus === 'not_started'
        const opacity = isBlocked ? 0.15 : 0.5

        const center1: [number, number] = [link.source.x, link.source.y]
        const center2: [number, number] = [link.target.x, link.target.y]

        const pathD = metaball(
          link.source.radius,
          link.target.radius,
          center1,
          center2,
          3.0,
          0.6,
        )

        if (!pathD) return null

        return (
          <path
            key={i}
            d={pathD}
            fill={`url(#connection-grad-${i})`}
            fillOpacity={opacity}
            stroke="none"
          />
        )
      })}
    </>
  )
}
