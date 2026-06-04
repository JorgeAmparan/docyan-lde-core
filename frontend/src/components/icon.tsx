"use client";

import { icons, type LucideProps } from "lucide-react";

/**
 * Lucide wrapper that accepts the kebab-case names used across the design kits
 * (e.g. "scan-line", "file-text") and renders the production `lucide-react`
 * icon — replacing the Lucide CDN the prototypes used. Stroke-only, currentColor.
 * Icon-only buttons must pass an `aria-label` on the button, so the SVG is hidden.
 */
function toPascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.75,
  ...rest
}: { name: string; size?: number } & LucideProps) {
  const key = toPascal(name) as keyof typeof icons;
  const Cmp = icons[key];
  if (!Cmp) {
    // Unknown icon name — render nothing rather than crash. (DESIGN: kits use a
    // small fixed icon vocabulary; any miss is a name typo to fix.)
    return null;
  }
  return (
    <Cmp
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    />
  );
}
