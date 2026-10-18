/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
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
        login: {
          bg: '#f8fafc',
          card: '#ffffff',
          primary: '#dc2626',
          primaryHover: '#b91c1c',
          primaryRing: '#ef4444',
          primarySoft: '#fef2f2',
          border: '#d1d5db',
          borderSoft: '#e5e7eb',
          heading: '#111827',
          muted: '#6b7280',
          subtle: '#4b5563',
          onPrimary: '#ffffff',
        },
        state: {
          success: '#047857',
          successBg: '#ecfdf5',
          successBorder: '#a7f3d0',
          error: '#b91c1c',
          errorBg: '#fef2f2',
          errorBorder: '#fecaca',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(0, 0, 0, 0.55)',
        glow: '0 0 0 1px rgba(220, 38, 38, 0.35), 0 12px 35px -14px rgba(220, 38, 38, 0.55)',
        cta: '0 4px 14px 0 rgba(220, 38, 38, 0.3)',
        ctaHover: '0 6px 20px 0 rgba(220, 38, 38, 0.42)',
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
