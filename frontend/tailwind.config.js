/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Yellow/Lime accent
        primary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#dce85d',
          600: '#c5d048',
          700: '#a8b63d',
          800: '#6b7229',
          900: '#4a5017',
        },
        // Backgrounds
        dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0a0a0f',
        },
        // Marginfi-inspired grays
        neutral: {
          50: '#fcfcfc',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#a1a1aa',
          400: '#868e95',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        // Success/Green
        success: {
          400: '#74b97f',
          500: '#74b97f',
          600: '#5da568',
        },
        // Error/Red
        error: {
          400: '#e06c6e',
          500: '#e06c6e',
          600: '#c85a5c',
        },
        // Warning/Orange
        warning: {
          400: '#dca204',
          500: '#dca204',
          600: '#c29003',
        },
        // Info/Blue
        info: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      backgroundColor: {
        'app': '#090a0a',
        'card': '#16181a',
        'secondary': '#161a1d',
        'tertiary': '#1a1e21',
        'hover': '#1e2225',
        'input': '#292e32',
      },
      borderColor: {
        'default': 'rgba(255, 255, 255, 0.06)',
        'hover': 'rgba(220, 232, 93, 0.3)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Inconsolata', 'Courier New', 'monospace'],
      },
      fontSize: {
        'xs': ['0.6875rem', { lineHeight: '1rem' }],      // 11px
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px
        'base': ['0.875rem', { lineHeight: '1.5rem' }],   // 14px
        'lg': ['0.9375rem', { lineHeight: '1.75rem' }],   // 15px
        'xl': ['1rem', { lineHeight: '1.75rem' }],        // 16px
        '2xl': ['1.25rem', { lineHeight: '2rem' }],       // 20px
        '3xl': ['1.5rem', { lineHeight: '2.25rem' }],     // 24px
        '4xl': ['2rem', { lineHeight: '2.5rem' }],        // 32px
        '5xl': ['2.5rem', { lineHeight: '3rem' }],        // 40px
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

