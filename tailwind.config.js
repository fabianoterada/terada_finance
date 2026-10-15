/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0f172a',
          surface: '#111827',
          elevated: '#1a2333',
          border: '#232f42',
          red: '#dc2626',
          redBright: '#ef4444',
          redDark: '#991b1b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(0, 0, 0, 0.55)',
        glow: '0 0 0 1px rgba(220, 38, 38, 0.35), 0 12px 35px -14px rgba(220, 38, 38, 0.55)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.22s ease-out',
      },
    },
  },
  plugins: [],
}
