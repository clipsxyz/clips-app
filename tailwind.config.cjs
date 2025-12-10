/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef7ff', 500: '#1976f3', 600: '#155bd6' }
      },
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter', 'sans-serif']
      },
      spacing: { 'safe': 'env(safe-area-inset-bottom)' },
      boxShadow: { card: '0 6px 24px -12px rgba(0,0,0,.25)' },
      keyframes: {
        shimmerGradient: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 0%' }
        }
      },
      animation: {
        shimmerGradient: 'shimmerGradient 3s linear infinite'
      }
    }
  },
  plugins: []
}
