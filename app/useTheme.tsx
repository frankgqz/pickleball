'use client'
import { createContext, useContext } from 'react'
import type { Theme, ThemeColors } from './theme'
export type { Theme, ThemeColors } from './theme'


export const STORAGE_KEY = 'gqz-theme'

export interface ThemeContextValue {
  activeTheme: Theme
  setActiveTheme: (theme: Theme) => void
  themeColors: ThemeColors
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
