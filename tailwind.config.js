/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Syne', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
      },
      colors: {
        // Raw ramps for spot colors (status pills, progress bars) that don't
        // map to one of shadcn's semantic tokens above. Each ramp keeps its
        // original semantic role from the previous theme (brand = error/
        // destructive/absent, success = positive/paid, warning = caution,
        // info = neutral highlight) — only the hues were retuned to the
        // "Kinetic Obsidian" dark palette (docs/design/latest stitch).
        brand: {
          // Warning Coral — error / destructive / absent states
          50: '#fff1f0',
          100: '#ffe1df',
          200: '#ffc7c4',
          300: '#ffa19c',
          400: '#ff6f68',
          500: '#ff4d4d',
          600: '#e0342f',
          700: '#b8241f',
          800: '#8f1c19',
          900: '#6b1613',
        },
        success: {
          // Hyper Teal — positive / paid / confirmed states
          50: '#e9fbf6',
          100: '#c9f5e9',
          200: '#96ebd4',
          300: '#5adcbc',
          400: '#22c9a0',
          500: '#05b08c',
          600: '#048d70',
          700: '#036b56',
          800: '#034f40',
          900: '#02362c',
        },
        warning: {
          50: '#fff8e8',
          100: '#ffedc2',
          200: '#ffdb85',
          300: '#fbc23f',
          400: '#e9a500',
          500: '#c98a00',
          600: '#a37000',
          700: '#7e5600',
          800: '#5d3f00',
          900: '#402c00',
        },
        info: {
          // Ice Cyan — neutral highlight / telemetry accent
          50: '#e5fdff',
          100: '#c0faff',
          200: '#85f4ff',
          300: '#3ee9fb',
          400: '#00d5ee',
          500: '#00b8d4',
          600: '#0092ac',
          700: '#007086',
          800: '#01536a',
          900: '#033c50',
        },
        // Developer console surfaces (design: Developer Console.dc.html) —
        // also used by shared/ui/EmptyState.tsx. Kept as-is; not part of
        // this redesign pass (see docs/DECISIONS.md).
        ink: {
          rail: '#161413',
          surface: '#2a2726',
          surface2: '#34302f',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
