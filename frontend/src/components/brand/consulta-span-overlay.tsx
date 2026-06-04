"use client";

import { Icon } from "@/components/icon";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export interface SourceSpan {
  /** Document title, e.g. "Manual CNC Haas VF-2". */
  title: string;
  /** Section reference, e.g. "§4.2.1 · Apriete de cabezal". */
  ref: string;
  /** Paragraphs of the source; the one with `highlight: true` is threaded. */
  paragraphs: Array<{ text: string; highlight?: boolean }>;
  /** Footer note, e.g. "Referenciado por 3 consultas en este CoDo". */
  footnote?: string;
}

/**
 * The cited-source overlay. Tapping a <CitationChip> opens the source document
 * at the exact span, highlighted in cinnabar — the "threading" that closes the
 * loop from answer → pedigree → source. Ported from `playbook.jsx` SourceOverlay.
 */
export function ConsultaSpanOverlay({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: SourceSpan | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 mx-auto flex max-w-reading flex-col bg-surface shadow-lg duration-slow data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
          aria-describedby={undefined}
        >
          <div className="sheet-head">
            <button className="x" onClick={() => onOpenChange(false)} aria-label="Volver">
              <Icon name="arrow-left" size={18} />
            </button>
            <div>
              <DialogPrimitive.Title style={{ fontSize: 15, fontWeight: 600 }}>
                {source?.title ?? "Fuente"}
              </DialogPrimitive.Title>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-fg)" }}>
                {source?.ref}
              </div>
            </div>
          </div>
          <div className="sheet-body" style={{ gap: 14 }}>
            {source?.paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: p.highlight ? "var(--fg)" : "var(--fg-muted)",
                  margin: 0,
                }}
              >
                {p.highlight ? (
                  <mark
                    style={{
                      background: "var(--cinnabar-100)",
                      borderBottom: "2px solid var(--cinnabar-500)",
                      padding: "1px 2px",
                      color: "var(--ink-900)",
                    }}
                  >
                    {p.text}
                  </mark>
                ) : (
                  p.text
                )}
              </p>
            ))}
            {source?.footnote && (
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 16,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-subtle)",
                }}
              >
                <Icon name="git-branch" size={14} />
                {source.footnote}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
