import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1c3f",
        "ink-soft": "#1e2d55",
        canvas: "#f4f6fa",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 28, 63, 0.05), 0 0 0 1px rgba(15, 28, 63, 0.05)",
        lift: "0 6px 16px -4px rgba(15, 28, 63, 0.14), 0 0 0 1px rgba(15, 28, 63, 0.08)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in": { from: { opacity: "0", transform: "translateX(16px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        "fade-up": "fade-up 0.25s ease-out both",
        "slide-in": "slide-in 0.2s ease-out both",
        "sheet-up": "sheet-up 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
