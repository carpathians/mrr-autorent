/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a25',
          600: '#23232f',
          500: '#2d2d3a',
          400: '#3a3a4a',
          300: '#5a5a6a',
          200: '#8a8a9a',
          100: '#c0c0cc'
        },
        accent: {
          green: '#00e676',
          red: '#ff5252',
          blue: '#448aff',
          orange: '#ff9100',
          yellow: '#ffd740'
        }
      }
    }
  },
  plugins: []
};
