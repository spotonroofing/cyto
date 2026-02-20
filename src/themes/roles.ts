// Color Role Mapping
// Maps UI element roles to palette keys.
// Components use getColor(palette, role, phaseIndex?) to resolve colors.
// 'phase' means the color comes from palette.phaseColors[phaseIndex].

import type { ThemePalette } from './palettes'

const roleMap: Record<string, keyof ThemePalette | 'phase'> = {
  // Map / canvas
  mapBg: 'bg',
  phaseOrb: 'phase',
  orbNucleus: 'phase',
  gooConnection: 'phase',
  particle: 'particle',
  dishRing: 'ring',

  // Nav buttons
  navButtonBg: 'phase',
  navButtonText: 'buttonText',

  // Panels & overlays
  panelBg: 'surface',
  panelText: 'text',
  panelTextMuted: 'textSecondary',
  panelBackdrop: 'backdrop',
  panelBorder: 'border',

  // Milestone detail
  headerGradient: 'phase',
  progressRing: 'phase',
  doneColor: 'done',

  // Charts
  chartGrid: 'border',
  chartTooltip: 'surface',
  chartAxis: 'textSecondary',

  // Interactive
  accentColor: 'accent',

  // Menu
  menuBackground: 'menuBg',
  menuItemText: 'menuText',

  // Buttons
  buttonBackground: 'buttonBg',
  buttonLabel: 'buttonText',
}

/**
 * Resolve a color from the palette by role ID.
 * For phase-based roles, pass a phaseIndex (0-7).
 */
export function getColor(palette: ThemePalette, role: string, phaseIndex?: number): string {
  const key = roleMap[role]
  if (!key) return palette.accent
  if (key === 'phase') return palette.phaseColors[phaseIndex ?? 0] ?? palette.phaseColors[0]!
  return palette[key] as string
}

/**
 * Pick a random phase color from the palette.
 * Useful for decorative elements that should vary.
 */
export function getRandomPhaseColor(palette: ThemePalette): string {
  return palette.phaseColors[Math.floor(Math.random() * palette.phaseColors.length)] ?? palette.phaseColors[0]!
}
