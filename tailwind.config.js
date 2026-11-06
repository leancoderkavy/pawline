/** @type {import('tailwindcss').Config} */
// Mirrors the design tokens in src/styles.css so utility classes match the brand.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)", rust: "var(--rust)", canvas: "var(--canvas)", surface: "var(--surface)",
        line: "var(--line)", mint: "var(--mint)", muted: "var(--muted)",
        paper: "var(--surface)", coral: "var(--rust)", sage: "var(--mint)",
      },
      fontFamily: { serif: ["var(--serif)"], sans: ["var(--sans)"] },
      borderRadius: { xs: "var(--radius-xs)", sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", xl: "var(--radius-xl)" },
    },
  },
  plugins: [],
};
