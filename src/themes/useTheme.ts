import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { getThemeById, type ThemePalette } from './palettes'
import { getColor, getRandomPhaseColor } from './roles'

export interface ThemeResult {
  palette: ThemePalette
  themeId: string
  themeName: string
  isDark: boolean
  /** Get phase color by index (0-7) */
  phaseColor: (index: number) => string
  /** Get color by role ID, optionally with phase index */
  color: (role: string, phaseIndex?: number) => string
  /** Pick a random color from the phase array */
  randomPhaseColor: () => string
}

export function useTheme(): ThemeResult {
  const themeId = useSettingsStore((s) => s.themeId)
  const mode = useSettingsStore((s) => s.theme)

  return useMemo(() => {
    const theme = getThemeById(themeId)
    const isDark = mode === 'dark'
    const palette = isDark ? theme.dark : theme.light

    return {
      palette,
      themeId: theme.id,
      themeName: theme.name,
      isDark,
      phaseColor: (index: number) => palette.phaseColors[index] ?? palette.phaseColors[0]!,
      color: (role: string, phaseIndex?: number) => getColor(palette, role, phaseIndex),
      randomPhaseColor: () => getRandomPhaseColor(palette),
    }
  }, [themeId, mode])
}
