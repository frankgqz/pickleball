export type Theme = 'wood' | 'dark' | 'sky' | 'matcha'

export interface ThemeColors {
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

export const themes: Record<Theme, ThemeColors> = {
  wood: {
    bg: '#1a120b',
    text: '#f5e6d3',
    subtext: '#b8956a',
    accent: '#d4a574',
    glow: 'radial-gradient(circle, rgba(139,115,85,0.15) 0%, transparent 70%)',
    buttonStart: '#d4a574',
    buttonEnd: '#8b6f47',
    buttonShadow: 'rgba(139, 111, 71, 0.5)',
    buttonShadowPressed: 'rgba(139, 111, 71, 0.2)',
    panel: '#241710',
    particleHues: [
      { hue: [15, 35],  sat: [50, 80] },
      { hue: [25, 45],  sat: [70, 90] },
      { hue: [0, 20],   sat: [65, 90] },
      { hue: [45, 70],  sat: [60, 90] },
      { hue: [80, 140], sat: [40, 80] },
    ],
    fontFamily: '"Inter", var(--font-geist-sans, system-ui), sans-serif',
    fontFamilyHeading: '"Inter", var(--font-geist-sans, system-ui), sans-serif',
    fontWeightBody: 400,
    fontWeightHeading: 700,
    fontSizeBase: '16px',
    fontSizeHeading: '32px',
    headingTracking: '-0.02em',
    bodyTracking: '0',
    radiusButton: '12px',
    radiusCard: '16px',
    radiusInput: '8px',
    radiusPill: '9999px',
    shadowCard: '0 4px 12px rgba(0,0,0,0.4)',
    shadowModal: '0 12px 32px rgba(0,0,0,0.5)',
    shadowDropdown: '0 8px 24px rgba(0,0,0,0.45)'
  },
  dark: {
    bg: '#0a0a0a',
    text: '#f5f5f5',
    subtext: '#a0a0a0',
    accent: '#8b8b8b',
    glow: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    buttonStart: '#3a3a3a',
    buttonEnd: '#1a1a1a',
    buttonShadow: 'rgba(0, 0, 0, 0.6)',
    buttonShadowPressed: 'rgba(0, 0, 0, 0.3)',
    panel: '#1a1a1a',
    particleHues: [
      { hue: [200, 260], sat: [70, 100] },
      { hue: [220, 280], sat: [70, 100] },
      { hue: [250, 290], sat: [70, 100] },
      { hue: [260, 300], sat: [70, 100] },
    ],
    fontFamily: '"JetBrains Mono", var(--font-geist-mono, ui-monospace, monospace)',
    fontFamilyHeading: '"JetBrains Mono", var(--font-geist-mono, ui-monospace, monospace)',
    fontWeightBody: 400,
    fontWeightHeading: 700,
    fontSizeBase: '16px',
    fontSizeHeading: '32px',
    headingTracking: '-0.02em',
    bodyTracking: '0',
    radiusButton: '8px',
    radiusCard: '12px',
    radiusInput: '6px',
    radiusPill: '9999px',
    shadowCard: '0 4px 12px rgba(0,0,0,0.6)',
    shadowModal: '0 12px 32px rgba(0,0,0,0.7)',
    shadowDropdown: '0 8px 24px rgba(0,0,0,0.65)'
  },
  sky: {
    bg: '#e0f2ff',
    text: '#0a2540',
    subtext: '#4a6b8a',
    accent: '#3b82f6',
    glow: 'radial-gradient(circle, rgba(180,190,220,0.08) 0%, transparent 70%)',
    buttonStart: '#3b82f6',
    buttonEnd: '#1d4ed8',
    buttonShadow: 'rgba(29, 78, 216, 0.4)',
    buttonShadowPressed: 'rgba(29, 78, 216, 0.2)',
    panel: '#ffffff',
    particleHues: [
      { hue: [200, 230], sat: [20, 40] },
      { hue: [230, 270], sat: [15, 35] },
      { hue: [250, 280], sat: [20, 40] },
    ],
    fontFamily: '"Inter", var(--font-geist-sans, system-ui), sans-serif',
    fontFamilyHeading: '"Inter", var(--font-geist-sans, system-ui), sans-serif',
    fontWeightBody: 400,
    fontWeightHeading: 700,
    fontSizeBase: '16px',
    fontSizeHeading: '32px',
    headingTracking: '-0.02em',
    bodyTracking: '0',
    radiusButton: '10px',
    radiusCard: '14px',
    radiusInput: '6px',
    radiusPill: '9999px',
    shadowCard: '0 4px 12px rgba(59, 130, 246, 0.15)',
    shadowModal: '0 12px 32px rgba(59, 130, 246, 0.2)',
    shadowDropdown: '0 8px 24px rgba(59, 130, 246, 0.18)'
  },
  matcha: {
    bg: '#f0f4e8',
    text: '#2d3a1f',
    subtext: '#6b7a52',
    accent: '#7a9e3f',
    glow: 'radial-gradient(circle, rgba(122,139,117,0.10) 0%, transparent 70%)',
    buttonStart: '#7a9e3f',
    buttonEnd: '#4f6b29',
    buttonShadow: 'rgba(79, 107, 41, 0.4)',
    buttonShadowPressed: 'rgba(79, 107, 41, 0.2)',
    panel: '#fbfbf2',
    particleHues: [
      { hue: [20, 45],  sat: [20, 50] },
      { hue: [90, 130], sat: [20, 50] },
      { hue: [140, 180], sat: [15, 45] },
    ],
    fontFamily: '"Inter", var(--font-geist-sans, system-ui), sans-serif',
    fontFamilyHeading: '"Inter", var(--font-geist-sans, system-ui), sans-serif',
    fontWeightBody: 400,
    fontWeightHeading: 700,
    fontSizeBase: '16px',
    fontSizeHeading: '32px',
    headingTracking: '-0.02em',
    bodyTracking: '0',
    radiusButton: '10px',
    radiusCard: '14px',
    radiusInput: '6px',
    radiusPill: '9999px',
    shadowCard: '0 4px 12px rgba(122, 158, 63, 0.15)',
    shadowModal: '0 12px 32px rgba(122, 158, 63, 0.2)',
    shadowDropdown: '0 8px 24px rgba(122, 158, 63, 0.18)'
  }
}

export const themeOrder: Theme[] = ['wood', 'dark', 'sky', 'matcha']
