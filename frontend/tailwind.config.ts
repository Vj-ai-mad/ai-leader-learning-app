import type { Config } from 'tailwindcss'

const config: Config = {
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
          500: '#3d4db7',
          600: '#2e3d9f',
          700: '#1a1a2e',
          900: '#0f0f1a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}

export default config
