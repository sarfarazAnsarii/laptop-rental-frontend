/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', light: '#EFF6FF', hover: '#1D4ED8' },
        accent:  { DEFAULT: '#7C3AED', light: '#F5F3FF' },
        success: { DEFAULT: '#16A34A', light: '#F0FDF4' },
        warning: { DEFAULT: '#D97706', light: '#FFFBEB' },
        danger:  { DEFAULT: '#DC2626', light: '#FEF2F2' },
        slate: {
          50:  '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
          400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
          800: '#1E293B', 900: '#0F172A',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Syne', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl':  '12px', '2xl': '16px', '3xl': '20px', '4xl': '24px',
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 20px -4px rgba(0,0,0,0.09), 0 4px 8px -4px rgba(0,0,0,0.05)',
        'modal':      '0 24px 48px rgba(0,0,0,0.13), 0 8px 16px rgba(0,0,0,0.06)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'shimmer':  'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
