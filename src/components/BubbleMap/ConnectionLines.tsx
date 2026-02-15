import type { BubblePosition } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'

interface ConnectionLinesProps {
  links: { source: BubblePosition; target: BubblePosition }[]
}

export function ConnectionLines({ links }: ConnectionLinesProps) {
  const theme = useSettingsStore((s) => s.theme)
  const isDark = theme === 'dark'
  const strokeColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'

  return (
    <g>
      {links.map((link, i) => {
        // Curved organic line between bubbles
        const dx = link.target.x - link.source.x
        const dy = link.target.y - link.source.y
        // Control point offset for curve (wavy organic feel)
        const cx = (link.source.x + link.target.x) / 2 + dy * 0.15
        const cy = (link.source.y + link.target.y) / 2 - dx * 0.15

        return (
          <path
            key={i}
            d={`M ${link.source.x} ${link.source.y} Q ${cx} ${cy} ${link.target.x} ${link.target.y}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.6}
          />
        )
      })}
    </g>
  )
}
