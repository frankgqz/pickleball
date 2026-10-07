export type Theme = 'wood' | 'night' | 'bubble' | 'matcha'

// ============================================
// Tier 1 — PRIMITIVES: the only typed colors.
// Each theme defines exactly these 7; every
// semantic value below derives from them.
// ============================================
export interface ThemePrimitives {
  bg: string       // page background
  surface: string  // panels, cards
  text: string     // primary text
  muted: string    // subtext; borders derive from this + alpha
  accent: string   // primary highlight (buttons start)
  accent2: string  // secondary highlight (buttons end)
  sparkle: string  // glow / particles / vibrancy
}

// ============================================
// Tier 2 — SEMANTIC (derived; same for all themes)
// ============================================
export interface ThemeColors {
  primitives: ThemePrimitives
  // core colors
  bg: string
  text: string
  subtext: string
  accent: string
  glow: string
  buttonStart: string
  buttonEnd: string
  buttonShadow: string
  buttonShadowPressed: string
  panel: string
  particleHues?: { hue: [number, number]; sat: [number, number] }[];

  // typography
  fontFamily: string
  fontFamilyHeading: string
  fontWeightBody: number
  fontWeightHeading: number
  fontSizeBase: string
  fontSizeHeading: string
  headingTracking: string
  bodyTracking: string
  // radius
  radiusButton: string
  radiusCard: string
  radiusInput: string
  radiusPill: string
  // shadows
  shadowCard: string
  shadowModal: string
  shadowDropdown: string
}

const SANS = '"Inter", var(--font-geist-sans, system-ui), sans-serif'
const MONO = '"JetBrains Mono", var(--font-geist-mono, ui-monospace), monospace'
const SERIF = '"Fraunces", Georgia, "Times New Roman", serif'

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface ThemeSpec {
  primitives: ThemePrimitives
  particleHues?: ThemeColors['particleHues']
  fontFamily?: string
  fontFamilyHeading?: string
  radiusButton: string
  radiusCard: string
  radiusInput: string
  shadowStrength?: number   // 0-1, how heavy the neutral shadows are
}

function make(t: ThemeSpec): ThemeColors {
  const p = t.primitives
  const s = t.shadowStrength ?? 0.4
  const body = t.fontFamily ?? SANS
  return {
    primitives: p,
    // derived core colors
    bg: p.bg,
    text: p.text,
    subtext: p.muted,
    accent: p.accent,
    panel: p.surface,
    glow: `radial-gradient(circle, ${hexA(p.sparkle, 0.14)} 0%, transparent 70%)`,
    buttonStart: p.accent,
    buttonEnd: p.accent2,
    buttonShadow: hexA(p.accent, 0.45),
    buttonShadowPressed: hexA(p.accent2, 0.3),
    particleHues: t.particleHues,
    // typography
    fontFamily: body,
    fontFamilyHeading: t.fontFamilyHeading ?? body,
    fontWeightBody: 400,
    fontWeightHeading: 700,
    fontSizeBase: '16px',
    fontSizeHeading: '32px',
    headingTracking: '-0.02em',
    bodyTracking: '0',
    // radius (per-theme mood)
    radiusButton: t.radiusButton,
    radiusCard: t.radiusCard,
    radiusInput: t.radiusInput,
    radiusPill: '9999px',
    // shadows derived from bg
    shadowCard: `0 4px 12px rgba(0,0,0,${s})`,
    shadowModal: `0 12px 32px rgba(0,0,0,${s + 0.1})`,
    shadowDropdown: `0 8px 24px rgba(0,0,0,${s + 0.05})`,
  }
}

export const themes: Record<Theme, ThemeColors> = {
  // WOOD — autumn warmth
  wood: make({
    primitives: {
      bg: '#1a120b',
      surface: '#241710',
      text: '#f5e6d3',
      muted: '#b8956a',
      accent: '#d4a574',
      accent2: '#8b6f47',
      sparkle: '#e8b06a',
    },
    particleHues: [
      { hue: [15, 35],  sat: [50, 80] },
      { hue: [25, 45],  sat: [70, 90] },
      { hue: [0, 20],   sat: [65, 90] },
      { hue: [45, 70],  sat: [60, 90] },
      { hue: [80, 140], sat: [40, 80] },
    ],
    radiusButton: '10px',
    radiusCard: '14px',
    radiusInput: '6px',
    shadowStrength: 0.4,
  }),

  // NIGHT — metal / cyberpunk, JetBrains Mono, neon orange + green
  night: make({
    primitives: {
      bg: '#131316',
      surface: '#1C1F24',
      text: '#f5f5f5',
      muted: '#959AA3',
      accent: '#FF6A1F',
      accent2: '#2EE66B',
      sparkle: '#2EE66B',
    },
    particleHues: [
      { hue: [15, 35], sat: [85, 100] },
      { hue: [120, 150], sat: [75, 95] },
      { hue: [35, 55], sat: [80, 100] },
      { hue: [100, 135], sat: [70, 95] },
    ],
    fontFamily: MONO,
    fontFamilyHeading: MONO,
    radiusButton: '6px',
    radiusCard: '8px',
    radiusInput: '4px',
    shadowStrength: 0.6,
  }),

  // BUBBLE — pastel blue/pink, rainbow particles, rounded
  bubble: make({
    primitives: {
      bg: '#EAF6FF',
      surface: '#ffffff',
      text: '#2E4A6B',
      muted: '#7FA8D6',
      accent: '#FF8FC5',
      accent2: '#8ED0FF',
      sparkle: '#FF8FC5',
    },
    particleHues: [
      { hue: [330, 360], sat: [60, 85] },
      { hue: [0, 40], sat: [65, 90] },
      { hue: [160, 200], sat: [45, 70] },
      { hue: [260, 290], sat: [50, 80] },
      { hue: [200, 235], sat: [55, 85] },
    ],
    radiusButton: '20px',
    radiusCard: '24px',
    radiusInput: '12px',
    shadowStrength: 0.12,
  }),

  // MATCHA — warm stone + sage, Fraunces serif
  matcha: make({
    primitives: {
      bg: '#f0f4e8',
      surface: '#fbfbf2',
      text: '#2d3a1f',
      muted: '#6b7a52',
      accent: '#7a9e3f',
      accent2: '#4f6b29',
      sparkle: '#a8c46a',
    },
    particleHues: [
      { hue: [20, 45],  sat: [20, 50] },
      { hue: [90, 130], sat: [20, 50] },
      { hue: [140, 180], sat: [15, 45] },
    ],
    fontFamily: SERIF,
    fontFamilyHeading: SERIF,
    radiusButton: '12px',
    radiusCard: '16px',
    radiusInput: '6px',
    shadowStrength: 0.12,
  }),
}

export const themeOrder: Theme[] = ['wood', 'night', 'bubble', 'matcha']
