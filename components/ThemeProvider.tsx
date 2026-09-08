import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'wood' | 'dark' | 'sky' | 'matcha'

interface ThemeColors {
  bg: string
  text: string
  subtext: string
  accent: string
  glow: string
  buttonStart: string
  buttonEnd: string
  buttonShadow: string
  buttonShadowPressed: string
}

const themes: Record<Theme, ThemeColors> = {
  wood: {
    bg: '#F5F0E8',
    text: '#5D4E3A',
    subtext: '#8B7355',
    accent: '#8B7355',
    glow: 'radial-gradient(circle, rgba(139,115,85,0.15) 0%, transparent 70%)',
    buttonStart: '#6B5344',
    buttonEnd: '#8B7355',
    buttonShadow: '0 8px 32px rgba(139,115,85,0.36), 0 2px 8px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)',
    buttonShadowPressed: '0 2px 12px rgba(139,115,85,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  dark: {
    bg: '#0D0E14',
    text: '#4b5068',
    subtext: '#2d3148',
    accent: '#6366f1',
    glow: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    buttonStart: '#4F46E5',
    buttonEnd: '#818CF8',
    buttonShadow: '0 8px 40px rgba(99,102,241,0.5), 0 2px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
    buttonShadowPressed: '0 2px 16px rgba(99,102,241,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
  sky: {
    bg: '#FFFFFF',
    text: '#5D7090',
    subtext: '#8090A8',
    accent: '#8090B5',
    glow: 'radial-gradient(circle, rgba(180,190,220,0.08) 0%, transparent 70%)',
    buttonStart: '#6080A8',
    buttonEnd: '#90B0D5',
    buttonShadow: '0 8px 32px rgba(96,128,168,0.3), 0 2px 8px rgba(96,128,168,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
    buttonShadowPressed: '0 2px 12px rgba(96,128,168,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  matcha: {
    bg: '#D9CFC4',
    text: '#5D6855',
    subtext: '#7A8B75',
    accent: '#7A8B75',
    glow: 'radial-gradient(circle, rgba(122,139,117,0.10) 0%, transparent 70%)',
    buttonStart: '#5A6B55',
    buttonEnd: '#7A8B70',
    buttonShadow: '0 8px 32px rgba(90,107,85,0.3), 0 2px 8px rgba(90,107,85,0.15), inset 0 1px 0 rgba(255,255,255,0.12)',
    buttonShadowPressed: '0 2px 12px rgba(90,107,85,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
}

const themeOrder: Theme[] = ['wood', 'dark', 'sky', 'matcha']

interface ThemeContextValue {
  activeTheme: Theme
  setActiveTheme: (theme: Theme) => void
  themeColors: ThemeColors
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'gqz-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveThemeState] = useState<Theme>('wood')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && themeOrder.includes(stored)) {
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

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
