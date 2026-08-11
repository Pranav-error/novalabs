import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          "deep-blue": "#2236A8",
          primary: "#2F67C7",
          cyan: "#32D3E6",
          teal: "#22C7D4",
          purple: "#8A2BBE",
          magenta: "#D21D8E",
          pink: "#F02B8F",
          navy: "#1B237A",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      animation: {
        "streak-flame": "flame 1.5s ease-in-out infinite",
        "badge-pop": "badgePop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.5s ease-out",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        flame: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(1.2)" },
        },
        badgePop: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
