/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef0f8',
          100: '#d5d9ef',
          200: '#a8b0d9',
          300: '#6b78b8',
          400: '#3d4db7',
          500: '#2e3d9f',
          600: '#232e6e',
          700: '#1a1a2e',
          800: '#121220',
          900: '#0a0a15'
        },
        navy: {
          50:  '#eef0f8',
          100: '#d5d9ef',
          200: '#a8b0d9',
          300: '#6b78b8',
          400: '#3d4db7',
          500: '#2e3d9f',
          600: '#232e6e',
          700: '#1a1a2e',
          800: '#121220',
          900: '#0a0a15'
        },
        amber: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309'
        },
        whatsapp: {
          DEFAULT: '#25d366',
          dark: '#25923a',
          light: '#e7f5ea'
        },
        stage: {
          1: '#3b82f6',
          2: '#14b8a6',
          3: '#8b5cf6',
          4: '#f97316',
          5: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
