/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        coal: {
          DEFAULT: "#0B0B0D",
          light: "#17171A",
          lighter: "#222226",
        },
        crimson: {
          DEFAULT: "#D81E2C",
          dark: "#8F0F1B",
          bright: "#FF3B44",
        },
        bone: "#F2F0EB",
        steel: "#8A8A92",
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
