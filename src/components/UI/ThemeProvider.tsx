import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { getThemeById } from '@/themes/palettes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme)
  const themeId = useSettingsStore((s) => s.themeId)

  useEffect(() => {
    const root = document.documentElement

    // Dark class toggle (keeps Tailwind dark: prefix working)
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Resolve active palette
    const themeObj = getThemeById(themeId)
    const palette = theme === 'dark' ? themeObj.dark : themeObj.light

    // Set CSS custom properties
    const s = root.style
    s.setProperty('--color-bg', palette.bg)
    s.setProperty('--color-surface', palette.surface)
    s.setProperty('--color-text', palette.text)
    s.setProperty('--color-text-secondary', palette.textSecondary)
    s.setProperty('--color-accent', palette.accent)
    s.setProperty('--color-done', palette.done)
    s.setProperty('--color-border', palette.border)
    s.setProperty('--color-backdrop', palette.backdrop)
    s.setProperty('--color-button-bg', palette.buttonBg)
    s.setProperty('--color-button-text', palette.buttonText)
    s.setProperty('--color-menu-bg', palette.menuBg)
    s.setProperty('--color-menu-text', palette.menuText)
    s.setProperty('--color-particle', palette.particle)
    s.setProperty('--color-ring', palette.ring)
    s.setProperty('--goo-opacity', String(palette.goo))
    s.setProperty('--nucleus-opacity', String(palette.nucleus))
    palette.phaseColors.forEach((c, i) => {
      s.setProperty(`--color-phase-${i}`, c)
    })

    // Update meta theme-color for mobile browser chrome
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', palette.metaThemeColor)
    }
  }, [theme, themeId])

  return <>{children}</>
}
