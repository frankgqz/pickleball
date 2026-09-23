export type Theme = 'wood' | 'dark' | 'sky' | 'matcha'

export const themeOrder: Theme[] = ['wood', 'dark', 'sky', 'matcha']

export interface ThemeColors {
  bg: string
  text: string
  subtext: string
  accent: string
  glow: string
  buttonStart: string
  buttonEnd: string
  buttonShadow: string
  buttonShadowPressed: string
  particleHues: { hue: [number, number]; sat: [number, number] }[]
}

export const themes: Record<Theme, ThemeColors> = {
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
    particleHues: [
      { hue: [15, 35],  sat: [50, 80] },
      { hue: [25, 45],  sat: [70, 90] },
      { hue: [0, 20],   sat: [65, 90] },
      { hue: [45, 70],  sat: [60, 90] },
      { hue: [80, 140], sat: [40, 80] },
    ],
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
    particleHues: [
      { hue: [200, 260], sat: [70, 100] },
      { hue: [220, 280], sat: [70, 100] },
      { hue: [250, 290], sat: [70, 100] },
      { hue: [260, 300], sat: [70, 100] },
    ],
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
    particleHues: [
      { hue: [200, 230], sat: [20, 40] },
      { hue: [230, 270], sat: [15, 35] },
      { hue: [250, 280], sat: [20, 40] },
    ],
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
    particleHues: [
      { hue: [20, 45],  sat: [20, 50] },
      { hue: [90, 130], sat: [20, 50] },
      { hue: [140, 180], sat: [15, 45] },
    ],
  },
}
