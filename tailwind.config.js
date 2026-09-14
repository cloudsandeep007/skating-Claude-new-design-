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
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
      },
      colors: {
        // Raw ramps from the design system, for spot colors (status pills,
        // progress bars) that don't map to one of shadcn's semantic tokens
        // above. Semantic tokens (border/background/primary/etc.) are still
        // the default choice — reach for these only when a design spec
        // calls out a specific ramp step (e.g. "success-600 fill").
        brand: {
          50: '#fff7f5',
          100: '#fff2ef',
          200: '#ffe0d9',
          300: '#ffc4b8',
          400: '#ff9783',
          500: '#ff563c',
          600: '#ec3013',
          700: '#ae1800',
          800: '#7c1405',
          900: '#4d170e',
        },
        success: {
          50: '#eff8f1',
          100: '#d9efdd',
          200: '#b4dfbd',
          300: '#83c993',
          400: '#4cae63',
          500: '#2f9149',
          600: '#22763a',
          700: '#1a5c2e',
          800: '#154524',
          900: '#11301a',
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
          50: '#eef5fd',
          100: '#d6e8fb',
          200: '#aed1f6',
          300: '#7bb2ee',
          400: '#4390e0',
          500: '#1f73c7',
          600: '#145ca4',
          700: '#0f4680',
          800: '#0c3560',
          900: '#0a2643',
        },
        // Developer console surfaces (design: Developer Console.dc.html)
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
