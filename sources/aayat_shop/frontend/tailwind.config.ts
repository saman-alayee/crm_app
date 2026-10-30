/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        /** Warm apparel palette: cream page, brown type, taupe gray */
        primary: {
          50: '#faf6f1',
          100: '#f3ebe3',
          200: '#e6d8cb',
          300: '#d2bfae',
          400: '#b89a82',
          500: '#8f735c',
          600: '#6f5644',
          700: '#5c4638',
          800: '#4a382d',
          900: '#3c322b',
        },
        accent: {
          400: '#c4b8ab',
          500: '#a89b8d',
          600: '#8c7f72',
        },
        surface: {
          DEFAULT: '#fffdfb',
          muted: '#f6f1ea',
          dark: '#3c322b',
        },
      },
      fontFamily: {
        sans: ['IRANSansX', 'Tahoma', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.06)',
        float: '0 -4px 24px rgba(0, 0, 0, 0.08)',
        header: '0 1px 0 rgba(0, 0, 0, 0.06)',
      },
      maxWidth: {
        store: '1280px',
      },
    },
  },
  plugins: [],
};
