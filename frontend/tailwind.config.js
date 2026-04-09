/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        terminal: {
          glow: '#2ecc71',
          dim: '#1a5c36',
          bg: '#0a0d0b',
          card: '#0f1410',
          border: '#1b3d2a'
        },
        status: {
          stable: '#2ecc71',
          unstable: '#f1c40f',
          critical: '#e74c3c',
          offline: '#95a5a6'
        },
        'background-light': '#f5f7f8',
        'background-dark': '#050a0f',
        'accent-green': '#0bda5b',
        'accent-red': '#fa6238',
        'design3-primary': '#0d7ff2',
        'v3-primary': '#f48c25',
        'v3-bg-light': '#f8f7f5',
        'v3-bg-dark': '#0a0e14'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        pixel: ['"Inter"', 'sans-serif'],
        display: ['"Inter"', 'sans-serif']
      },
      animation: {
        'flicker': 'flicker 0.15s infinite',
        'scanline': 'scanline 8s linear infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
      },
      keyframes: {
        flicker: {
          '0%': { opacity: '0.97' },
          '5%': { opacity: '0.95' },
          '10%': { opacity: '0.9' },
          '15%': { opacity: '0.98' },
          '20%': { opacity: '0.94' },
          '100%': { opacity: '1' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', textShadow: '0 0 10px #2ecc71' },
          '50%': { opacity: '0.8', textShadow: '0 0 20px #2ecc71' }
        },
        'terminal-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' }
        }
      }
    },
  },
  plugins: [],
}
