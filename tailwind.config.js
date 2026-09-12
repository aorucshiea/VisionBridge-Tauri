/** @type {import('tailwindcss').Config} */

/* ---------------------------------------------------------------------------
   Design tokens — "Paper & Marker"
   ---------------------------------------------------------------------------
   ink      warm paper neutrals (never pure black / pure white)
   primary  the highlighter accent — reserved for the capture action
   accent   pine teal — supporting colour for secondary emphasis
   success / danger  muted, non-neon system states

   The legacy key names (primary / secondary / accent / success / danger) are
   preserved so existing utility classes keep resolving.
--------------------------------------------------------------------------- */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-sans)'],
        body: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        ink: {
          50: '#FAF9F7',
          100: '#F4F2EE',
          200: '#E8E4DD',
          300: '#D6D0C6',
          400: '#ADA69A',
          500: '#837C71',
          600: '#5F594F',
          700: '#443F38',
          800: '#2A2721',
          900: '#1B1915',
          950: '#121110',
        },
        /* Highlighter accent */
        primary: {
          50: '#FDF7EC',
          100: '#FAEBD1',
          200: '#F4D5A1',
          300: '#EBB86A',
          400: '#DE9A38',
          500: '#C67C1B',
          600: '#A86412',
          700: '#854D0E',
          800: '#663C0D',
          900: '#53310D',
          950: '#2E1C08',
        },
        /* Cool neutral, for informational surfaces */
        secondary: {
          50: '#F4F7FA',
          100: '#E7EDF3',
          200: '#CBD8E4',
          300: '#A3B8CB',
          400: '#7391A9',
          500: '#547088',
          600: '#40586C',
          700: '#334656',
          800: '#283745',
          900: '#1F2B36',
          950: '#141C24',
        },
        /* Pine teal — secondary emphasis / step-2 affordances */
        accent: {
          50: '#EDF7F3',
          100: '#D3EBE1',
          200: '#A7D7C5',
          300: '#74BCA4',
          400: '#479E84',
          500: '#2C7F69',
          600: '#216654',
          700: '#1C5344',
          800: '#194237',
          900: '#15362E',
          950: '#0A1F1A',
        },
        success: {
          50: '#F0F8F3',
          100: '#DCEFE3',
          200: '#B9DFC8',
          300: '#8AC7A4',
          400: '#5CAB80',
          500: '#3E8E63',
          600: '#2F7350',
          700: '#265C40',
          800: '#1F4A34',
          900: '#1A3D2C',
          950: '#0C2118',
        },
        danger: {
          50: '#FDF1EF',
          100: '#FBE2DE',
          200: '#F6C5BD',
          300: '#EE9F93',
          400: '#E17464',
          500: '#C33F32',
          600: '#A5322A',
          700: '#852A24',
          800: '#6C2621',
          900: '#5A231F',
          950: '#310F0D',
        },
        /* Theme-specific colors (kept in sync with src/theme/themes.ts) */
        surface: {
          light: '#FFFFFF',
          dark: '#1D1B17',
          moonlight: '#122824',
          arctic: '#131D28',
        },
        background: {
          light: '#FAF9F7',
          dark: '#141310',
          moonlight: '#0C1A17',
          arctic: '#0C131B',
        },
      },
      borderRadius: {
        card: '14px',
        field: '9px',
      },
      boxShadow: {
        /* Warm-tinted, layered — reads as depth rather than a grey smear. */
        soft: '0 1px 2px rgba(27, 25, 21, 0.05), 0 1px 1px rgba(27, 25, 21, 0.03)',
        'soft-lg': '0 2px 6px rgba(27, 25, 21, 0.06), 0 8px 24px -12px rgba(27, 25, 21, 0.14)',
        'soft-xl': '0 4px 12px rgba(27, 25, 21, 0.07), 0 24px 56px -20px rgba(27, 25, 21, 0.22)',
        float: '0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 8px 20px -6px rgba(27, 25, 21, 0.18), 0 32px 64px -24px rgba(27, 25, 21, 0.28)',
        bar: '0 -1px 0 rgba(27, 25, 21, 0.06), 0 -12px 32px -20px rgba(27, 25, 21, 0.24)',
        glow: '0 4px 18px -4px rgba(198, 124, 27, 0.45)',
        'glow-lg': '0 8px 32px -6px rgba(198, 124, 27, 0.5)',
        'inner-soft': 'inset 0 1px 2px rgba(27, 25, 21, 0.05)',
      },
      transitionTimingFunction: {
        'ease-out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out-quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
      },
      transitionDuration: {
        press: '100ms',
        fast: '160ms',
        base: '240ms',
        slow: '380ms',
      },
      animation: {
        'rise': 'vb-rise 240ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'slide-up': 'vb-rise 240ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'pop': 'vb-pop 240ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'fade-in': 'fadeIn 200ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'sweep': 'sweep 1.15s cubic-bezier(0.76, 0, 0.24, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        sweep: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
