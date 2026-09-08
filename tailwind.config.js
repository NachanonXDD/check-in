/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f0f4f8',
        surface: '#ffffff',
        primary: '#0b57d0',
        ink: '#1f1f1f',
        'ink-muted': '#444746',
        'ink-soft': '#5f6368',
        border: '#e1e3e1',
      },
      fontFamily: {
        sans: ['"Google Sans"', '"Google Sans Flex"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
