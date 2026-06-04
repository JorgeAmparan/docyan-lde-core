"use client";

/**
 * Citation pedigree chip — the signature brand object. Cinnabar, corner-bracket
 * mark, mono label, "↗" affordance. Tapping it threads to the exact source span
 * via <ConsultaSpanOverlay>. Ported 1:1 from `ui_kits/pwa` (`Cite` + `.cite`).
 */
export function CitationChip({
  label,
  onOpen,
  className = "",
}: {
  label: string;
  onOpen?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`cite ${className}`}
      onClick={onOpen}
      aria-label={`Ver fuente: ${label}`}
    >
      <span className="brk" aria-hidden="true" />
      {label} <span style={{ opacity: 0.6 }} aria-hidden="true">↗</span>
    </button>
  );
}

/** Standalone corner-bracket glyph (citation bracket derivative). */
export function CitationBracket({ size = 13 }: { size?: number }) {
  return <span className="brk" aria-hidden="true" style={{ width: size, height: size }} />;
}
