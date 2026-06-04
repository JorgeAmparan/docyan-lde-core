import type { Config } from "tailwindcss";

/**
 * DOCYAN LDE — Tailwind tokens mirrored 1:1 from `colors_and_type.css`
 * (design bundle source of truth). Semantic colors reference CSS variables so
 * light/dark (`[data-theme="dark"]`) swap automatically. The raw palette is
 * also exposed by name (amate-50, ink-900, cinnabar-500…) for utilities.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---- raw palette ----
        amate: {
          50: "#FAF7F1",
          100: "#F4EEE3",
          200: "#EAE1D1",
          300: "#DBCDB6",
          400: "#C2AF92",
        },
        stone: {
          400: "#A4937C",
          500: "#82725E",
          600: "#635648",
        },
        ink: {
          700: "#463C32",
          800: "#332B23",
          900: "#211C16",
          950: "#15110D",
        },
        cinnabar: {
          50: "#FBEEE9",
          100: "#F6D8CC",
          200: "#EDB39F",
          300: "#E08A6C",
          400: "#D9633F",
          500: "#CF4124",
          600: "#B5331A",
          700: "#8F2713",
        },
        success: { DEFAULT: "#2C7A57", 100: "#DCEEE4", 600: "#2C7A57" },
        warning: { DEFAULT: "#C0820F", 100: "#F7EACB", 600: "#C0820F" },
        caution: { DEFAULT: "#E6B72E", 500: "#E6B72E" },
        danger: { DEFAULT: "#C2160E", 100: "#F8D9D6", 600: "#C2160E" },
        info: { DEFAULT: "#3E6E78", 100: "#D8E7E9", 600: "#3E6E78" },

        // ---- semantic aliases (theme-aware via CSS vars) ----
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-sunken": "var(--surface-sunken)",
        "surface-raised": "var(--surface-raised)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        "fg-on-accent": "var(--fg-on-accent)",
        "fg-on-ink": "var(--fg-on-ink)",
        "border-strong": "var(--border-strong)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          weak: "var(--accent-weak)",
          fg: "var(--accent-fg)",
        },

        // ---- shadcn compatibility (mapped to DOCYAN tokens) ----
        border: "var(--border)",
        input: "var(--border-strong)",
        ring: "var(--ring)",
        background: "var(--bg)",
        foreground: "var(--fg)",
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--fg-on-accent)",
        },
        secondary: {
          DEFAULT: "var(--surface)",
          foreground: "var(--fg)",
        },
        muted: {
          DEFAULT: "var(--surface-sunken)",
          foreground: "var(--fg-muted)",
        },
        popover: {
          DEFAULT: "var(--surface)",
          foreground: "var(--fg)",
        },
        card: {
          DEFAULT: "var(--surface)",
          foreground: "var(--fg)",
        },
        destructive: {
          DEFAULT: "#C2160E",
          foreground: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Menlo", "monospace"],
        serif: ['"IBM Plex Serif"', "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        "display-2xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-xl": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["2.25rem", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        eyebrow: ["0.75rem", { letterSpacing: "0.12em" }],
      },
      letterSpacing: {
        eyebrow: "0.12em",
        tightish: "-0.02em",
      },
      borderRadius: {
        xs: "3px",
        sm: "5px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "22px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(33, 28, 22, 0.06)",
        sm: "0 1px 3px rgba(33, 28, 22, 0.08), 0 1px 2px rgba(33, 28, 22, 0.05)",
        md: "0 3px 8px rgba(33, 28, 22, 0.10), 0 1px 3px rgba(33, 28, 22, 0.06)",
        lg: "0 12px 28px rgba(33, 28, 22, 0.14), 0 4px 8px rgba(33, 28, 22, 0.07)",
        cinnabar: "0 6px 18px rgba(207, 65, 36, 0.22)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      maxWidth: {
        reading: "720px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
