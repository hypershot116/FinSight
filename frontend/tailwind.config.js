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
          DEFAULT: '#0284C7',
          light: '#E0F2FE',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
        },
        surface: '#FFFFFF',
        background: '#F4F6FA',
        textMain: '#0F172A',
        textMuted: '#64748B',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
