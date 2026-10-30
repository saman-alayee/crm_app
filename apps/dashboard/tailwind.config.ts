/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--hr-primary-50)',
          100: 'var(--hr-primary-100)',
          200: 'var(--hr-primary-200)',
          600: 'var(--hr-primary-600)',
          700: 'var(--hr-primary-700)',
          800: 'var(--hr-primary-800)',
          DEFAULT: 'var(--hr-primary)',
        },
        accent: {
          DEFAULT: 'var(--hr-accent)',
          500: 'var(--hr-accent)',
        },
        surface: {
          DEFAULT: 'var(--hr-surface)',
          muted: 'var(--hr-surface)',
          elevated: 'var(--hr-surface-elevated)',
          card: 'var(--hr-card)',
        },
        ink: {
          DEFAULT: 'var(--hr-text)',
          muted: 'var(--hr-muted)',
        },
        line: {
          DEFAULT: 'var(--hr-border)',
          strong: 'var(--hr-border-strong)',
        },
      },
      fontFamily: {
        sans: ['var(--ds-font-sans)'],
        display: ['var(--ds-font-display)'],
      },
      fontSize: {
        xs: ['var(--ds-text-xs)', { lineHeight: 'var(--ds-leading-normal)' }],
        sm: ['var(--ds-text-sm)', { lineHeight: 'var(--ds-leading-normal)' }],
        base: ['var(--ds-text-md)', { lineHeight: 'var(--ds-leading-normal)' }],
        lg: ['var(--ds-text-lg)', { lineHeight: 'var(--ds-leading-snug)' }],
        xl: ['var(--ds-text-xl)', { lineHeight: 'var(--ds-leading-tight)' }],
        '2xl': ['var(--ds-text-2xl)', { lineHeight: 'var(--ds-leading-tight)' }],
      },
      borderRadius: {
        sm: 'var(--ds-radius-sm)',
        md: 'var(--ds-radius-md)',
        lg: 'var(--ds-radius-lg)',
        xl: 'var(--ds-radius-lg)',
        '2xl': 'var(--ds-radius-xl)',
        '3xl': 'var(--ds-radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--ds-shadow-xs)',
        sm: 'var(--ds-shadow-sm)',
        card: 'var(--ds-shadow-sm)',
        md: 'var(--ds-shadow-md)',
        float: 'var(--ds-shadow-lg)',
        header: 'var(--ds-shadow-xs)',
        focus: 'var(--ds-shadow-focus)',
      },
      spacing: {
        sidebar: 'var(--ds-sidebar-width)',
        header: 'var(--ds-header-height)',
      },
      transitionTimingFunction: {
        brand: 'var(--ds-ease)',
      },
      transitionDuration: {
        brand: '250ms',
        slow: '400ms',
      },
      maxWidth: {
        content: 'var(--ds-content-max)',
      },
      zIndex: {
        header: '30',
        sidebar: '40',
        drawer: '50',
        toast: '80',
      },
    },
  },
  plugins: [],
};
