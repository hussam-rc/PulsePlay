/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#1B1830', soft: '#5E5974' },
        paper: { DEFAULT: '#FAF7F2', card: '#FFFFFF', line: '#ECE6DC' },
        violet: { 50: '#F1EDFF', 100: '#E4DCFF', 500: '#6D4AFF', 600: '#5A36F0', 700: '#4425C4' },
        sky: { 50: '#E8F1FF', 500: '#2F6FEB', 600: '#2259C7' },
        teal: { 50: '#E2F7F4', 500: '#14A38B', 600: '#0E8370' },
        sun: { 50: '#FFF3DD', 500: '#E59A1C' },
        coral: { 50: '#FFE9E2', 500: '#E2553A' },
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { soft: '0 1px 2px rgba(30,20,60,.06), 0 10px 30px rgba(30,20,60,.08)' },
    },
  },
  plugins: [],
};
