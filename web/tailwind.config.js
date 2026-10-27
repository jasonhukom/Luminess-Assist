/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#08090E',
          card: 'rgba(15, 18, 28, 0.75)',
          border: 'rgba(56, 189, 248, 0.18)',
          glow: '#00f0ff',
          neonPurple: '#a855f7',
          neonCyan: '#38bdf8',
          neonGreen: '#34d399',
          neonOrange: '#fb923c',
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float-slow': 'float 5s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 18px rgba(56, 189, 248, 0.45))' },
          '50%': { filter: 'drop-shadow(0 0 32px rgba(168, 85, 247, 0.65))' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
