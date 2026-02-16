// cyto Theme Definitions — Spec Section 2.2

export const phaseColors = {
  light: {
    0: '#FFB5A7', // Soft coral — Immediate
    1: '#FCD5CE', // Pastel peach — Assess
    2: '#D8BBFF', // Lavender — Eradication
    3: '#B8F3D4', // Soft mint — Restoration
    4: '#FFF3B0', // Pastel yellow — Food Reintro
    5: '#A2D2FF', // Pastel blue — Retest
    6: '#FFAFCC', // Pastel pink — Optimization
    7: '#C7DFC5', // Soft sage — Maintenance
  },
  dark: {
    0: '#E07A6B', // Deep coral
    1: '#D4967E', // Burnt peach
    2: '#9B72CF', // Deep lavender
    3: '#5BBF8A', // Emerald
    4: '#E0C44A', // Amber
    5: '#5B8BC9', // Steel blue
    6: '#D46A8C', // Rose
    7: '#7BA87B', // Forest sage
  },
} as const

export const themeColors = {
  light: {
    background: '#FFF5F2',
    text: '#2D2A32',
    accent: '#D4A574',
    done: '#B5C4B1',
  },
  dark: {
    background: '#0F0E17',
    text: '#FFFFFE',
    accent: '#C49A6C',
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
