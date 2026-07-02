/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",        // #f44444
          foreground: "hsl(var(--primary-foreground))",
          50:  "#fff5f5",
          100: "#ffe0e0",
          200: "#ffbcbc",
          300: "#ff8585",
          400: "#f85757",
          500: "#f44444",  // ← BRAND PRIMARY
          600: "#d92b2b",
          700: "#b81f1f",
          800: "#981f1f",
          900: "#7c2020",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",
        // Status colors
        status: {
          ready:             "#3b82f6",  // blue
          dispatched:        "#eab308",  // yellow
          delivered:         "#f97316",  // orange
          sold:              "#22c55e",  // green
          expired:           "#ef4444",  // red
          void:              "#6b7280",  // gray
          returned_good:     "#14b8a6",  // teal
          returned_damaged:  "#f44444",  // primary red
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backdropBlur: {
        xs: "4px",
        glass: "16px",
      },
      boxShadow: {
        glass:   "0 8px 32px rgba(0,0,0,0.4)",
        "glow-sm": "0 0 10px rgba(244,68,68,0.3)",
        "glow-md": "0 0 20px rgba(244,68,68,0.4), 0 0 40px rgba(244,68,68,0.15)",
        "glow-lg": "0 0 40px rgba(244,68,68,0.5), 0 0 80px rgba(244,68,68,0.2)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulse_glow: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(244,68,68,0.3)" },
          "50%":      { boxShadow: "0 0 24px rgba(244,68,68,0.7)" },
        },
      },
      animation: {
        "fade-in":      "fade-in 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "pulse-glow":   "pulse_glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
