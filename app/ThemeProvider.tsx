'use client'
import { useEffect, useState, ReactNode } from 'react'
import { ThemeContext } from './useTheme'
import { getStoredTheme, setStoredTheme } from './storage'
import type { Theme } from './theme'
import { themes } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveThemeState] = useState<Theme>('wood')

  useEffect(() => {
    const stored = getStoredTheme()
    if (stored) setActiveThemeState(stored)
  }, [])

  useEffect(() => {
    const colors = themes[activeTheme]
    const root = document.documentElement

    // colors
    root.style.setProperty('--theme-bg', colors.bg)
    root.style.setProperty('--theme-text', colors.text)
    root.style.setProperty('--theme-subtext', colors.subtext)
    root.style.setProperty('--theme-accent', colors.accent)
    root.style.setProperty('--theme-glow', colors.glow)
    root.style.setProperty('--theme-btn-start', colors.buttonStart)
    root.style.setProperty('--theme-btn-end', colors.buttonEnd)
    root.style.setProperty('--theme-btn-shadow', colors.buttonShadow)
    root.style.setProperty('--theme-btn-shadow-pressed', colors.buttonShadowPressed)
    root.style.setProperty('--theme-panel', colors.panel)

    // typography
    root.style.setProperty('--theme-font-family', colors.fontFamily)
    root.style.setProperty('--theme-font-family-heading', colors.fontFamilyHeading)
    root.style.setProperty('--theme-font-weight-body', String(colors.fontWeightBody))
    root.style.setProperty('--theme-font-weight-heading', String(colors.fontWeightHeading))
    root.style.setProperty('--theme-font-size-base', colors.fontSizeBase)
    root.style.setProperty('--theme-font-size-heading', colors.fontSizeHeading)
    root.style.setProperty('--theme-heading-tracking', colors.headingTracking)
    root.style.setProperty('--theme-body-tracking', colors.bodyTracking)

    // radius
    root.style.setProperty('--theme-radius-button', colors.radiusButton)
    root.style.setProperty('--theme-radius-card', colors.radiusCard)
    root.style.setProperty('--theme-radius-input', colors.radiusInput)
    root.style.setProperty('--theme-radius-pill', colors.radiusPill)

    // shadows
    root.style.setProperty('--theme-shadow-card', colors.shadowCard)
    root.style.setProperty('--theme-shadow-modal', colors.shadowModal)
    root.style.setProperty('--theme-shadow-dropdown', colors.shadowDropdown)

    root.setAttribute('data-theme', activeTheme)
  }, [activeTheme])

  const setActiveTheme = (theme: Theme) => {
    setActiveThemeState(theme)
    setStoredTheme(theme)
  }

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, themeColors: themes[activeTheme] }}>
      {children}
    </ThemeContext.Provider>
  )
}
