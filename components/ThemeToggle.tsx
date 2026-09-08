'use client'

import { useTheme } from './ThemeProvider'

type Theme = 'wood' | 'dark' | 'sky' | 'matcha'

const themeOrder: Theme[] = ['wood', 'dark', 'sky', 'matcha']

const themes: Record<Theme, { accent: string }> = {
  wood: { accent: '#8B7355' },
  dark: { accent: '#6366f1' },
  sky: { accent: '#8090B5' },
  matcha: { accent: '#7A8B75' },
}

const themeIcons: Record<Theme, string> = {
  wood: '🍂',
  dark: '🌙',
  sky: '🌤️',
  matcha: '🍵',
}

const toggleBg: Record<Theme, string> = {
  wood: '#E8E0D5',
  dark: '#1a1d2e',
  sky: '#E8EBF5',
  matcha: '#E0DDD5',
}

export default function ThemeToggle() {
  const { activeTheme, setActiveTheme } = useTheme()

  const handleToggle = () => {
    const idx = themeOrder.indexOf(activeTheme)
    setActiveTheme(themeOrder[(idx + 1) % themeOrder.length])
  }

  return (
    <button
      onClick={handleToggle}
      className="relative w-14 h-7 rounded-full transition-all duration-300"
      style={{ backgroundColor: toggleBg[activeTheme] }}
      aria-label={`Theme: ${activeTheme}`}
    >
      <div
        className="absolute top-1 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center text-xs"
        style={{
          left: 4,
          backgroundColor: themes[activeTheme].accent,
        }}
      >
        {themeIcons[activeTheme]}
      </div>
    </button>
  )
}
