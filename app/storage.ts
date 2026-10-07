import type { Theme } from './theme'

export const STORAGE_KEY = 'gqz-theme'

const VALID_THEMES: Theme[] = ['wood', 'night', 'bubble', 'matcha']

// legacy cookie values from before the rename
const LEGACY: Record<string, Theme> = { dark: 'night', sky: 'bubble' }

export function getStoredTheme(): Theme | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === STORAGE_KEY && value) {
      const mapped = (LEGACY[value] ?? value) as Theme
      if (VALID_THEMES.includes(mapped)) return mapped
    }
  }
  return null
}

export function setStoredTheme(theme: Theme): void {
  document.cookie = `${STORAGE_KEY}=${theme}; Domain=.gqz.app; Path=/; Max-Age=31536000; SameSite=Lax`
}
