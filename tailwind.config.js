/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#f7f1e8',
        card: {
          DEFAULT: '#fffdf8',
          alt: '#fffdf9',
        },
        warm: {
          inner: '#fbf3e9',
          peach: '#fff4e7',
        },
        accent: {
          DEFAULT: '#cf6534',
          hover: '#b9552f',
        },
        title: {
          DEFAULT: '#3f3135',
          alt: '#46313b',
        },
        text: {
          DEFAULT: '#675d55',
          secondary: '#7a6c60',
        },
        border: {
          light: '#ead8c2',
          mid: '#eaded2',
          soft: '#eee4d7',
          sep: 'rgba(125, 102, 88, 0.28)',
        }
      },
      fontFamily: {
        brand: ['Caveat', 'cursive'],
        title: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'panel': '32px',
        'card': '28px',
        'inner': '20px',
      },
      boxShadow: {
        'warm-soft': '0 10px 30px -10px rgba(125, 102, 88, 0.12)',
        'warm-md': '0 15px 35px -5px rgba(125, 102, 88, 0.18)',
      }
    },
  },
  plugins: [],
}
