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
        cream: {
          50: "#FDFAF5",
          100: "#F5F0E8",
          150: "#F2F0EB",
          200: "#EEEBE3",
          300: "#E8E4DC",
          400: "#E0DBD3",
          500: "#C8C3BB",
        },
        accent: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "#1D4ED8",
          soft: "#DBEAFE",
        },
        ink: {
          900: "#1A1A1A",
          600: "#5C5C5C",
          400: "#9A9A9A",
          300: "#B0B0B0",
          200: "#D1D1D1",
        },
        energy: {
          DEFAULT: "#E8702A",
          soft: "#FEF3E8",
          dark: "#C55A1E",
        },
        progress: {
          DEFAULT: "#10B981",
          soft: "#D1FAE5",
        },
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
          DEFAULT: "hsl(var(--accent))",
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
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
        streak: "0 4px 16px rgba(232, 112, 42, 0.14)",
        xp: "0 4px 16px rgba(37, 99, 235, 0.12)",
        challenge: "0 4px 16px rgba(16, 185, 129, 0.12)",
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
