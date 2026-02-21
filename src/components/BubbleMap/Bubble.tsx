import { useRef, useEffect } from 'react'
import { milestones, phases } from '@/stores/roadmapStore'
import { useTheme } from '@/themes'
import { useDebugStore } from '@/stores/debugStore'
import {
  Microscope, FileSearch, Pill, HeartPulse,
  Utensils, FlaskConical, Sparkles, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const phaseIcons: Record<number, LucideIcon> = {
  0: Microscope, 1: FileSearch, 2: Pill, 3: HeartPulse,
  4: Utensils, 5: FlaskConical, 6: Sparkles, 7: ShieldCheck,
}

/** Derive a stable phase offset from milestoneId for independent animation timing */
function hashPhase(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i)
  return h * 0.37
}

const NUCLEUS_WOBBLE_STEPS = 64
const ICON_LABEL_GAP = 5 // px of extra vertical spacing between phase icon and text label

interface BubbleProps {
  milestoneId: string
  x: number
  y: number
  radius: number
  progress: number
  onTap: (milestoneId: string) => void
}

export function Bubble({ milestoneId, x, y, radius, onTap }: BubbleProps) {
  const { palette, phaseColor } = useTheme()
  const nucleusRef = useRef<SVGPathElement>(null)

  // DEBUG: Register rendering path B (once per app — multiple Bubble instances)
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    if (!w.__cytoDebugPaths) w.__cytoDebugPaths = {}
    ;(w.__cytoDebugPaths as Record<string, string>).B = 'SVG nucleus path + #nucleus-goo filter'
  }, [])

  const milestone = milestones.find((m) => m.id === milestoneId)
  const phase = phases.find((p) => p.id === milestone?.phaseId)
  const phaseIndex = phase ? phases.indexOf(phase) : 0
  const color = phaseColor(phaseIndex)

  // Animate nucleus wobble via direct DOM manipulation (no React re-renders)
  useEffect(() => {
    const el = nucleusRef.current
    if (!el) return
    const nucleusR = radius * 0.655
    const p = hashPhase(milestoneId)
    const targetDt = 0
    let rafId = 0
    let lastFrame = 0

    const tick = (now: number) => {
      const dbg = useDebugStore.getState()
      const effectiveDt = dbg.fpsCap > 0 ? 1000 / dbg.fpsCap : targetDt
      if (effectiveDt > 0 && now - lastFrame < effectiveDt) {
        rafId = requestAnimationFrame(tick)
        return
      }
      lastFrame = now

      let d = ''
      if (dbg.nucleusWobble) {
        const t = now / 1000
        for (let i = 0; i <= NUCLEUS_WOBBLE_STEPS; i++) {
          const angle = (i / NUCLEUS_WOBBLE_STEPS) * Math.PI * 2
          let r = nucleusR
          // Breathing — freq 0.8 (membrane uses 0.5)
          r += Math.sin(t * 0.8 + p * 2) * nucleusR * 0.025
          // 2-lobe deformation — freq 0.6 (membrane uses 0.3)
          r += Math.sin(2 * angle + t * 0.6 + p) * nucleusR * 0.035
          // 3-lobe deformation — freq 0.45 (membrane uses 0.25)
          r += Math.sin(3 * angle + t * 0.45 + p * 1.3) * nucleusR * 0.025
          r += Math.sin(5 * angle - t * 0.35 + p * 0.7) * nucleusR * 0.015
          const px = Math.cos(angle) * r
          const py = Math.sin(angle) * r
          d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`
        }
      } else {
        // Static circle when nucleus wobble is disabled
        for (let i = 0; i <= NUCLEUS_WOBBLE_STEPS; i++) {
          const angle = (i / NUCLEUS_WOBBLE_STEPS) * Math.PI * 2
          const px = Math.cos(angle) * nucleusR
          const py = Math.sin(angle) * nucleusR
          d += `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`
        }
      }
      el.setAttribute('d', d + 'Z')
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [milestoneId, radius])

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={() => onTap(milestoneId)}
      role="button"
      tabIndex={0}
    >
      {/* Nucleus — organic wobbling core with goo filter */}
      <g filter="url(#nucleus-goo)">
        <path ref={nucleusRef} fill={color} opacity={0.7} />
      </g>
      {/* Hit target */}
      <circle cx={0} cy={0} r={radius} fill="transparent" />

      {/* Phase icon — wrapped in <g> for reliable mobile positioning
          (nested <svg> x/y attributes are unreliable on mobile Safari) */}
      {(() => {
        const Icon = phaseIcons[phaseIndex]
        if (!Icon) return null
        const size = Math.round(radius * 0.28)
        return (
          <g transform={`translate(${-size / 2} ${-size / 2 - 12 - ICON_LABEL_GAP})`}>
            <Icon
              width={size} height={size}
              color={palette.text}
              opacity={0.7}
              strokeWidth={2}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        )
      })()}

      {/* Phase name — primary label */}
      <text
        x={0} y={5}
        textAnchor="middle" dominantBaseline="central"
        fontSize={11}
        fontFamily="'Space Grotesk', sans-serif"
        fontWeight={600}
        fill={palette.text}
        opacity={0.85}
      >
        {getShortPhaseName(phaseIndex)}
      </text>

      {/* Phase number — secondary, smaller */}
      <text
        x={0} y={18}
        textAnchor="middle" dominantBaseline="central"
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={400}
        fill={palette.text}
        opacity={0.45}
        letterSpacing="0.5"
      >
        {`P${phaseIndex}`}
      </text>
    </g>
  )
}

const shortPhaseNames: Record<number, string> = {
  0: 'Baseline', 1: 'Interpret', 2: 'Treatment', 3: 'Rebuild',
  4: 'Diet Trial', 5: 'Retest', 6: 'Optimize', 7: 'Maintain',
}

function getShortPhaseName(i: number): string {
  return shortPhaseNames[i] ?? ''
}
