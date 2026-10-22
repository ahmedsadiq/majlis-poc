import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07090c", 900: "#0c1117", 800: "#121a22", 700: "#1b2530", 600: "#273441" },
        sand: { 50: "#fbf7ef", 100: "#f3ebdb", 200: "#e6d8bd", 300: "#d4c09a" },
        gold: { 300: "#f1d58a", 400: "#e2bd5c", 500: "#c9a243", 600: "#a8842f" },
        uae: { red: "#ef3340", green: "#00843d", black: "#0b0b0b", white: "#ffffff" },
        emerald: { 450: "#19a463" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(226,189,92,.25), 0 20px 60px -20px rgba(226,189,92,.25)",
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 20px 50px -30px rgba(0,0,0,.8)",
      },
      keyframes: {
        pulseRing: { "0%": { transform: "scale(.9)", opacity: ".8" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
      },
      animation: { pulseRing: "pulseRing 1.6s ease-out infinite", rise: "rise .35s ease-out both", shimmer: "shimmer 2.5s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config;
