import type { ThemeConfig, ThemeName } from '../types'

/* ---------------------------------------------------------------------------
   Four palettes built on one shared structure: warm-paper neutrals, a single
   highlighter accent for the capture action, and a pine-teal support colour.

   `primary` (marker) is deliberately the only saturated colour in the UI — it
   earns attention because nothing else competes with it.
--------------------------------------------------------------------------- */
export const themes: Record<ThemeName, ThemeConfig> = {
  light: {
    name: '纸',
    nameEn: 'Paper',
    primary: '#C67C1B',
    onPrimary: '#FFFDF8',
    background: '#FAF9F7',
    card: '#FFFFFF',
    text: '#1B1915',
    textSecondary: '#5F594F',
    textMuted: '#ADA69A',
    border: '#E8E4DD',
    hairline: 'rgba(27,25,21,0.08)',
    accent: '#2C7F69',
    success: '#2F7350',
    danger: '#C33F32',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    inputBg: '#F4F2EE',
    inputBorder: '#D6D0C6',
    inputFocus: '#C67C1B',
    glassBg: 'rgba(251,250,248,0.74)',
    glassBorder: 'rgba(255,255,255,0.6)',
    overlay: 'rgba(24,22,18,0.42)',
  },
  dark: {
    name: '墨',
    nameEn: 'Ink',
    primary: '#DE9A38',
    onPrimary: '#241805',
    background: '#141310',
    card: '#1D1B17',
    text: '#F2EFE9',
    textSecondary: '#ADA69A',
    textMuted: '#6E675C',
    border: '#302C26',
    hairline: 'rgba(242,239,233,0.09)',
    accent: '#5FB79A',
    success: '#5CAB80',
    danger: '#E17464',
    surface: '#1D1B17',
    elevated: '#242119',
    inputBg: '#100F0D',
    inputBorder: '#39342C',
    inputFocus: '#DE9A38',
    glassBg: 'rgba(24,22,19,0.74)',
    glassBorder: 'rgba(242,239,233,0.12)',
    overlay: 'rgba(10,9,8,0.55)',
  },
  moonlight: {
    name: '青瓷',
    nameEn: 'Celadon',
    primary: '#63C6A8',
    onPrimary: '#06201A',
    background: '#0C1A17',
    card: '#122824',
    text: '#E4F3EE',
    textSecondary: '#8FBFAF',
    textMuted: '#5A8375',
    border: '#1E3D36',
    hairline: 'rgba(228,243,238,0.1)',
    accent: '#E0B15C',
    success: '#63C6A8',
    danger: '#E5745F',
    surface: '#122824',
    elevated: '#17332D',
    inputBg: '#091512',
    inputBorder: '#22453D',
    inputFocus: '#63C6A8',
    glassBg: 'rgba(14,30,26,0.74)',
    glassBorder: 'rgba(228,243,238,0.13)',
    overlay: 'rgba(6,16,13,0.55)',
  },
  arctic: {
    name: '夜色',
    nameEn: 'Midnight',
    primary: '#7FB2E0',
    onPrimary: '#061422',
    background: '#0C131B',
    card: '#131D28',
    text: '#E6EFF8',
    textSecondary: '#8FA5BC',
    textMuted: '#5C7286',
    border: '#1F2E3E',
    hairline: 'rgba(230,239,248,0.1)',
    accent: '#DE9A38',
    success: '#5CAB80',
    danger: '#E17464',
    surface: '#131D28',
    elevated: '#18242F',
    inputBg: '#090F15',
    inputBorder: '#243546',
    inputFocus: '#7FB2E0',
    glassBg: 'rgba(14,21,29,0.74)',
    glassBorder: 'rgba(230,239,248,0.13)',
    overlay: 'rgba(6,10,15,0.55)',
  },
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Mix a colour toward the theme background — used for quiet tints (active
 * nav backgrounds, badges) that must stay readable in every palette.
 */
export function tint(color: string, background: string, amount = 0.12): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const [r1, g1, b1] = parse(color)
  const [r2, g2, b2] = parse(background)
  const m = (a: number, b: number) => Math.round(a * amount + b * (1 - amount))
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`
}
