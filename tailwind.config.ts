import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // ── ClassMode palette ──────────────────────────────────────────────
        // These read the CSS variables in client/src/index.css rather than
        // repeating their values, so a colour follows the theme. Until
        // 2026-09-01 they were literal hexes here, which meant `text-progress`
        // rendered the light-mode green in dark mode too — 3.12:1, below the
        // contrast floor — and no edit to index.css could reach it.
        //
        // rgb(...) not hsl(...): index.css stores these as RGB channels so the
        // values survive the round-trip exactly. `/ <alpha-value>` is what makes
        // `bg-progress/10` and `border-energy/30` work.
        cream: {
          50: "rgb(var(--cream-50) / <alpha-value>)",
          100: "rgb(var(--cream-100) / <alpha-value>)",
          150: "rgb(var(--cream-150) / <alpha-value>)",
          200: "rgb(var(--cream-200) / <alpha-value>)",
          300: "rgb(var(--cream-300) / <alpha-value>)",
          400: "rgb(var(--cream-400) / <alpha-value>)",
          // No --cream-500 token; this is a config-only step on the ramp.
          500: "#C8C3BB",
        },
        accent: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
        },
        // Terracotta for TYPE. --accent measures 3.15:1 on light paper, below
        // the text floor; this is the darkened variant DESIGN.md requires for
        // words, and it resolves back to the true terracotta in dark mode.
        terracotta: {
          ink: "rgb(var(--terracotta-ink) / <alpha-value>)",
        },
        ink: {
          900: "rgb(var(--ink-900) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          400: "rgb(var(--ink-400) / <alpha-value>)",
          // No tokens for these two; config-only steps on the ramp.
          300: "#B0B0B0",
          200: "#D1D1D1",
        },
        energy: {
          DEFAULT: "rgb(var(--energy) / <alpha-value>)",
          soft: "rgb(var(--energy-soft) / <alpha-value>)",
          dark: "rgb(var(--energy-dark) / <alpha-value>)",
        },
        progress: {
          DEFAULT: "rgb(var(--progress) / <alpha-value>)",
          soft: "rgb(var(--progress-soft) / <alpha-value>)",
        },
        // An unfinished thought is not an error: warm brown, never red, and
        // never --destructive.
        "not-yet": "rgb(var(--not-yet) / <alpha-value>)",
        // Institutional status for the registers (attendance, fees). --overdue
        // is deliberately distinct from --destructive: a fact, not an action.
        verified: "rgb(var(--verified) / <alpha-value>)",
        overdue: "rgb(var(--overdue) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        eduaccent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        illustration: "hsl(var(--illustration-bg))",
        ticker: {
          DEFAULT: "hsl(var(--ticker-bg))",
          foreground: "hsl(var(--ticker-text))",
        },
        bubble: {
          1: "hsl(var(--bubble-1))",
          2: "hsl(var(--bubble-2))",
          3: "hsl(var(--bubble-3))",
        },
      },
      fontFamily: {
        display: ["Crimson Pro", "Georgia", "serif"],
        heading: ["DM Sans", "system-ui", "sans-serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        card: "0 4px 12px rgba(0,0,0,0.06)",
        modal: "0 20px 40px rgba(0,0,0,0.12)",
        streak: "0 4px 16px rgba(240, 165, 0, 0.12)",
        xp: "0 4px 16px rgba(204, 120, 92, 0.10)",
        challenge: "0 4px 16px rgba(74, 124, 89, 0.10)",
      },
      backgroundImage: {
        "gradient-streak": "var(--grad-streak)",
        "gradient-xp": "var(--grad-xp)",
        "gradient-badge": "var(--grad-badge)",
        "gradient-challenge": "var(--grad-challenge)",
        "gradient-math": "var(--grad-math)",
        "gradient-physics": "var(--grad-physics)",
        "gradient-chemistry": "var(--grad-chemistry)",
        "gradient-biology": "var(--grad-biology)",
        "gradient-english": "var(--grad-english)",
        "gradient-history": "var(--grad-history)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 25s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
