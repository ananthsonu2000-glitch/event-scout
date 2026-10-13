import type { Config } from "tailwindcss";

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Keep in sync with scripts/gen-theme.mjs
const RAMPS = ["slate", "rose", "amber", "red", "emerald", "sky", "indigo", "violet", "orange", "teal", "cyan", "green", "blue"];

/** Every colour is a CSS variable (see src/app/theme.css) so light and dark mode share the same class names. */
const ramp = (name: string) => Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));

const config: Config = {
  darkMode: ["class", ":root.dark"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(RAMPS.map((n) => [n, ramp(n)])),
        white: "rgb(var(--c-white) / <alpha-value>)",
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--c-ink-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in": { from: { opacity: "0", transform: "translateX(16px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "bar-grow": { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        "ring-in": { from: { strokeDasharray: "0 100" } },
        "line-draw": { from: { strokeDashoffset: "1" }, to: { strokeDashoffset: "0" } },
      },
      animation: {
        "fade-up": "fade-up 0.25s ease-out both",
        "slide-in": "slide-in 0.2s ease-out both",
        "sheet-up": "sheet-up 0.25s ease-out both",
        "bar-grow": "bar-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "ring-in": "ring-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
        "line-draw": "line-draw 0.9s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
