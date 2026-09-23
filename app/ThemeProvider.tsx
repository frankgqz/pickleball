'use client'
import { useEffect, useState, ReactNode } from 'react'
import { ThemeContext, STORAGE_KEY } from './useTheme'
import type { Theme } from './theme'
import { themes } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveThemeState] = useState<Theme>('wood')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ['wood', 'dark', 'sky', 'matcha'].includes(stored)) {
      setActiveThemeState(stored)
    }
  }, [])

  useEffect(() => {
    const colors = themes[activeTheme]
    const root = document.documentElement
    root.style.setProperty('--theme-bg', colors.bg)
    root.style.setProperty('--theme-text', colors.text)
    root.style.setProperty('--theme-subtext', colors.subtext)
    root.style.setProperty('--theme-accent', colors.accent)
    root.style.setProperty('--theme-glow', colors.glow)
    root.style.setProperty('--theme-btn-start', colors.buttonStart)
    root.style.setProperty('--theme-btn-end', colors.buttonEnd)
    root.style.setProperty('--theme-btn-shadow', colors.buttonShadow)
    root.style.setProperty('--theme-btn-shadow-pressed', colors.buttonShadowPressed)
    root.setAttribute('data-theme', activeTheme)
  }, [activeTheme])

  const setActiveTheme = (theme: Theme) => {
    setActiveThemeState(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, themeColors: themes[activeTheme] }}>
      {children}
    </ThemeContext.Provider>
  )
}
