/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        turf: {
          DEFAULT: "#0B3D2E",
          dark: "#082A20",
          light: "#124E3A",
        },
        chalk: "#F5F3EC",
        gold: "#D4A24C",
        alert: "#C1432F",
        slate: "#3A4750",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
