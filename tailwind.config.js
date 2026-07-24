/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#153c36", paper: "#f7f5ef", coral: "#e95d45", sage: "#dfe7d8" },
      fontFamily: { serif: ["Lora", "Georgia", "serif"], sans: ["Inter", "ui-sans-serif", "system-ui"] }
    }
  },
  plugins: []
}
