// cyto Theme Definitions — Spec Section 2.2

export const phaseColors = {
  light: {
    0: '#E09888', // Warm Coral — Baseline/Immediate
    1: '#D09BA8', // Dusty Rose — Assess
    2: '#B898B8', // Soft Mauve — Eradication
    3: '#CCB090', // Warm Clay — Restoration
    4: '#C4A080', // Terracotta — Food Reintro
    5: '#B0A0B0', // Dusty Taupe — Retest
    6: '#D0A098', // Rose Clay — Optimization
    7: '#A8A898', // Warm Stone — Maintenance
  },
  dark: {
    0: '#B86850', // Deep Coral
    1: '#986070', // Deep Rose
    2: '#806080', // Deep Mauve
    3: '#A08050', // Deep Clay
    4: '#907048', // Deep Terracotta
    5: '#706878', // Deep Taupe
    6: '#A06858', // Deep Rose Clay
    7: '#688060', // Deep Sage Stone
  },
} as const

export const themeColors = {
  light: {
    background: '#FFF8F7',
    text: '#2D2A32',
    accent: '#C0907A',
    done: '#B5C4B1',
  },
  dark: {
    background: '#0F0E17',
    text: '#FFFFFE',
    accent: '#A07060',
    done: '#4A8B7F',
  },
} as const

export const phaseNames: Record<number, string> = {
  0: 'Immediate',
  1: 'Assess + Decide',
  2: 'Eradication',
  3: 'Restoration',
  4: 'Food Reintroduction',
  5: 'Retest + Reassess',
  6: 'Optimization',
  7: 'Maintenance',
}

export function getPhaseColor(phaseIndex: number, isDark: boolean): string {
  const colors = isDark ? phaseColors.dark : phaseColors.light
  return colors[phaseIndex as keyof typeof colors] ?? colors[0]
}

export function getPhaseColorOpacity(_phaseIndex: number, isDark: boolean, status: string): number {
  if (status === 'blocked' || status === 'not_started') return isDark ? 0.18 : 0.22
  if (status === 'completed') return isDark ? 0.45 : 0.5
  return isDark ? 0.35 : 0.4
}
