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
    bg: '#131316',
    text: '#f5f5f5',
    subtext: '#959AA3',
    accent: '#FF6A1F',
    glow: 'radial-gradient(circle, rgba(46,230,107,0.12) 0%, transparent 70%)',
    buttonStart: '#FF6A1F',
    buttonEnd: '#2EE66B',
    buttonShadow: 'rgba(255, 106, 31, 0.45)',
    buttonShadowPressed: 'rgba(46, 230, 107, 0.35)',
    panel: '#1C1F24',
    particleHues: [
      { hue: [15, 35], sat: [85, 100] },
      { hue: [120, 150], sat: [75, 95] },
      { hue: [35, 55], sat: [80, 100] },
      { hue: [100, 135], sat: [70, 95] },
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
    bg: '#EAF6FF',
    text: '#2E4A6B',
    subtext: '#7FA8D6',
    accent: '#FF8FC5',
    glow: 'radial-gradient(circle, rgba(255,143,197,0.14) 0%, transparent 70%)',
    buttonStart: '#FF9BC7',
    buttonEnd: '#8ED0FF',
    buttonShadow: 'rgba(140, 180, 230, 0.35)',
    buttonShadowPressed: 'rgba(140, 180, 230, 0.2)',
    panel: '#ffffff',
    particleHues: [
      { hue: [330, 360], sat: [60, 85] },
      { hue: [0, 40], sat: [65, 90] },
      { hue: [160, 200], sat: [45, 70] },
      { hue: [260, 290], sat: [50, 80] },
      { hue: [200, 235], sat: [55, 85] },
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
    shadowCard: '0 4px 12px rgba(120, 170, 230, 0.25)',
    shadowModal: '0 12px 32px rgba(120, 170, 230, 0.3)',
    shadowDropdown: '0 8px 24px rgba(120, 170, 230, 0.28)'
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
