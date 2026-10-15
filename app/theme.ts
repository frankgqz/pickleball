export type Theme = 'wood' | 'night' | 'bubble' | 'onsen'

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
  // Tier 3 — interactive ladder (mirror of theme.css; per-theme voices live in CSS)
  motionFast: string
  motionBase: string
  motionEase: string
  error: string
  disabledOpacity: number
  focusRing: string
  hoverShadow: string
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
const FREDERICKA = '"Fredericka the Great", Georgia, serif'
const CAUSE = '"Cause", ui-rounded, "Segoe Sans", system-ui, sans-serif'
const PLAYWRITE = '"Playwrite NG Modern", cursive'
const FRAUNCES = '"Fraunces", Georgia, serif'
const DMSANS = '"DM Sans", ui-sans-serif, system-ui, sans-serif'
const BELLOTA = '"Bellota", ui-rounded, sans-serif'
const SHANTELL = '"Shantell Sans", ui-rounded, cursive'

// Single source of truth for the font FILE loading. The font names below are
// just strings — the browser needs the files too. Consumers render this as a
// <link> in their layout head (Turbopack strips the theme.css @import — see
// AGENTS.md); theme.css keeps the same URL as its @import for vite consumers.
export const googleFontsUrl = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Fredericka+the+Great&family=Bellota:wght@300;400;700&family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap'
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
    // interactive ladder (generic derivations; theme.css carries the voices)
    motionFast: '150ms',
    motionBase: '220ms',
    motionEase: 'cubic-bezier(0.2, 0, 0, 1)',
    error: '#c4453c',
    disabledOpacity: 0.45,
    focusRing: `0 0 0 2px ${hexA(p.bg, 0.9)}, 0 0 0 5px ${p.accent}`,
    hoverShadow: `0 0 18px ${hexA(p.sparkle, 0.4)}`,
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
      accent2: '#e8b06a',
      sparkle: '#f4c887',
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
    fontFamily: FREDERICKA,
    fontFamilyHeading: FREDERICKA,
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
    fontFamily: SHANTELL,
    fontFamilyHeading: SHANTELL,
    radiusButton: '20px',
    radiusCard: '24px',
    radiusInput: '12px',
    shadowStrength: 0.12,
  }),

  // ONSEN STONE — wet stone, cedar, moss, steam; Fraunces + DM Sans
  onsen: make({
    primitives: {
      bg: '#e9eae5',
      surface: '#f7f8f4',
      text: '#2e3538',
      muted: '#6b7472',
      accent: '#6f8464',
      accent2: '#a9714e',
      sparkle: '#c5d4cc',
    },
    particleHues: [
      { hue: [80, 130], sat: [8, 22] },   // moss
      { hue: [20, 40],  sat: [18, 38] },  // cedar
      { hue: [160, 190], sat: [6, 16] },  // steam
    ],
    fontFamily: BELLOTA,
    fontFamilyHeading: BELLOTA, // one font for everything — Frank's pick
    radiusButton: '12px',
    radiusCard: '16px',
    radiusInput: '6px',
    shadowStrength: 0.12,
  }),
}

export const themeOrder: Theme[] = ['wood', 'night', 'bubble', 'onsen']
