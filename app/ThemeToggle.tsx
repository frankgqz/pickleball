import { useState, useEffect } from 'react'
import { useTheme } from './useTheme'
import { Theme, themes, themeOrder } from './theme'

const themeIcons: Record<Theme, string> = {
  wood: '\u{1F342}',
  night: '\u{1F319}',
  bubble: '\u{1FAE7}',
  onsen: '\u2668\uFE0F',
  onigiri: '\u{1F359}',
}

// The pentagon toggle (Frank 2026-11-24): five circles TOUCHING in a
// pentagon, the whole shape sized to a line's height. The selected one
// swells TOWARD THE CENTRE until it almost covers the other four (they
// stay visible, same size). Tapping the cluster advances CLOCKWISE;
// tapping a circle jumps straight to it. Reduced motion = no animation.
const R = 12    // pentagon circumradius (loose enough that the four stay
const r = 4.5   // visible beside the swelled one — Frank 2026-11-24: too cramped)
const SIZE = 36 // the cluster box — line-height-ish
const C = SIZE / 2

export function ThemeToggle() {
  const { activeTheme, setActiveTheme } = useTheme()
  const idx = Math.max(0, themeOrder.indexOf(activeTheme))
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])
  const ease = 'cubic-bezier(.34,1.56,.64,1)'
  const move = reduce ? 'none' : `left 320ms ${ease}, top 320ms ${ease}, transform 320ms ${ease}, box-shadow 320ms ease`
  const advance = () => setActiveTheme(themeOrder[(idx + 1) % themeOrder.length])

  return (
    <button
      onClick={advance}
      aria-label="Toggle theme"
      title="toggle theme (clockwise)"
      style={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        padding: 0,
        background: 'transparent',
        border: 'none',
        // the theme's button ladder paints EVERY <button> (square base with
        // border + shadows) — this is a bare cluster, not a button pill
        // (Frank 2026-11-24: 'remove that')
        boxShadow: 'none',
        cursor: 'pointer',
      }}
    >
      {themeOrder.map((key, i) => {
        const active = key === activeTheme
        // the pentagon vertex (clockwise from top) ...
        const ang = ((i * 72 - 90) * Math.PI) / 180
        const vx = C + R * Math.cos(ang)
        const vy = C + R * Math.sin(ang)
        // ... and the selected circle swells 35% toward the centre: it eats
        // the middle while the four keep their outer halves in view
        const cx = vx + (C - vx) * 0.35
        const cy = vy + (C - vy) * 0.35
        return (
          <div
            key={key}
            title={key}
            style={{
              position: 'absolute',
              left: cx - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '9999px',
              // washed, not solid (Frank 2026-11-24: 'a bit too opaque')
              background: `color-mix(in srgb, ${themes[key].accent} 65%, transparent)`,
              transform: active ? 'scale(2.2)' : 'scale(1)',
              boxShadow: active
                ? `0 0 10px ${themes[key].primitives.sparkle}`
                : '0 1px 2px rgba(0,0,0,0.18)',
              transition: move,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              lineHeight: 1,
              zIndex: active ? 2 : 1,
              // ALL circles are decoration — one action only: clicking
              // anywhere advances CLOCKWISE (Frank 2026-11-24: per-circle
              // jumps read as 'sort of random'; just do clockwise)
              pointerEvents: 'none',
            }}
          >
            {active ? themeIcons[key] : ''}
          </div>
        )
      })}
    </button>
  )
}
