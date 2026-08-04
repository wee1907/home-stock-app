/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Thai', 'Prompt', 'sans-serif'],
        display: ['Prompt', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        clay: {
          50: '#fbf5f4', 100: '#f6e9e5', 200: '#ecd2ca', 300: '#dfb2a4',
          400: '#cf8b77', 500: '#c1694f', 600: '#96513d', 700: '#713e2e',
          800: '#4d2a20', 900: '#301a14', 950: '#190e0a',
        },
        sage: {
          50: '#f7f8f6', 100: '#edefeb', 200: '#dbdfd7', 300: '#c1c9bb',
          400: '#a2ad99', 500: '#7c8b6f', 600: '#61714f', 700: '#495739',
          800: '#334027', 900: '#212b19', 950: '#141c0f',
        },
        honey: {
          50: '#fcf9f3', 100: '#f8f0e2', 200: '#f1e1c5', 300: '#e7cc9c',
          400: '#dbb26b', 500: '#d4a24c', 600: '#b08233', 700: '#886527',
          800: '#61481c', 900: '#413013', 950: '#22190a',
        },
        cream: {
          DEFAULT: '#FAF6EF', 50: '#FDFBF8', 100: '#FAF6EF', 200: '#F2EBDD',
        },
        ink: {
          50: '#f9f7f6', 100: '#f3f0ec', 200: '#e7e0da', 300: '#d3c7bb',
          400: '#b39e89', 500: '#957a5f', 600: '#705c48', 700: '#544536',
          800: '#3b3026', 900: '#2c241c', 950: '#1c1712',
        },
      },
    },
  },
  plugins: [],
}
