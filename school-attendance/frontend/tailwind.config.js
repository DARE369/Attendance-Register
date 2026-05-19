/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          900: '#1a3a52',
          800: '#2d5a7a',
          700: '#3a6d91',
        },
      },
      animation: {
        'pulse-border': 'pulse-border 2s ease-in-out infinite',
        'flash-green':  'flash-green 1.2s ease-out forwards',
        'flash-red':    'flash-red 1.2s ease-out forwards',
        'slide-in':     'slide-in 0.3s ease-out',
        'fade-in':      'fade-in 0.25s ease-out',
        'count-up':     'count-up 0.4s ease-out',
      },
      keyframes: {
        'pulse-border': {
          '0%, 100%': { borderColor: '#2563eb', opacity: '1' },
          '50%':       { borderColor: '#93c5fd', opacity: '0.6' },
        },
        'flash-green': {
          '0%':   { backgroundColor: 'rgba(16,185,129,0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-red': {
          '0%':   { backgroundColor: 'rgba(239,68,68,0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'slide-in': {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'count-up': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
