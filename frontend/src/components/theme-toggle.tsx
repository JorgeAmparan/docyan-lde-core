"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** Warm dark-mode toggle (collaborators in variable lighting). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={toggle}
      className={`icon-btn ${className}`}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{ width: 34, height: 34, borderRadius: "var(--radius-md)", border: "none", background: "transparent", color: "var(--fg-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
    >
      {theme === "dark" ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
    </button>
  );
}
