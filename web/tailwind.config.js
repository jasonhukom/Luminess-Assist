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
        // Optimus Color Architecture
        optimus: {
          bg: '#fafaf9',
          fg: '#080503',
          card: '#ffffff',
          muted: '#5e534a',
          border: '#dad7d0',
          secondary: '#f3f2ee',
          accent: '#e7e4dd',
          subtle: '#ecebe7',
        },
        dark: {
          bg: '#080503',
          fg: '#fafaf9',
          card: '#120f0d',
          cardBorder: 'rgba(255, 255, 255, 0.1)',
          muted: '#a89c92',
          subtle: '#1c1917',
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        display: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'char-in': 'charIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'line-reveal': 'lineReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float-gentle': 'floatGentle 4s ease-in-out infinite',
      },
      keyframes: {
        charIn: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        lineReveal: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
