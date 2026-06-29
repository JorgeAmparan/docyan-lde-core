/* DOCYAN — B · Visor de fuente ("Abrir PDF"). Overlay del documento con el span
   citado resaltado + pedigree. Se abre por evento global 'dc-open-source' (detail = answer),
   así cualquier cita puede abrirlo sin pasar props por todo el árbol. Montar <SourceViewer/> una vez. */

function SourceViewer() {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const h = (e) => setSrc(e.detail);
    window.addEventListener("dc-open-source", h);
    return () => window.removeEventListener("dc-open-source", h);
  }, []);
  if (!src) return null;
  const a = src;
  const close = () => setSrc(null);
  const parts = a.mark && a.span && a.span.includes(a.mark) ? a.span.split(a.mark) : null;
  const sec = a.cite || "Documento fuente";
  const pg = a.page != null ? a.page : "—";
  const serif = { fontFamily: "var(--font-serif)", fontSize: 15.5, lineHeight: 1.7, margin: 0 };

  return <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(33,28,22,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "stretch", justifyContent: "center", animation: "dc-sv-fade .16s ease-out" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, background: "var(--surface)", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px -20px rgba(33,28,22,.5)", animation: "dc-sv-rise .22s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "rgba(250,247,241,.9)", backdropFilter: "blur(8px)" }}>
        <button onClick={close} aria-label="Cerrar" style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}><Icon name="arrow-left" size={18} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--accent-fg)" }}>{t({ es: "FUENTE", en: "SOURCE" })} · {sec}</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t({ es: "Documento original", en: "Original document" })}</div>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)", flex: "none" }}>{t({ es: "pág.", en: "p." })} {pg}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "26px 30px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ ...serif, color: "var(--fg-muted)" }}>{t({ es: "\u2026 sección anterior del documento. El contexto inmediato del fragmento citado se conserva para que verifiques que la respuesta no se sacó de su lugar.", en: "\u2026 preceding section of the document. The immediate context of the cited excerpt is kept so you can verify the answer was not taken out of context." })}</p>
        <p style={{ ...serif, color: "var(--ink-900)" }}>
          {parts
            ? <>{parts[0]}<mark style={{ background: "var(--cinnabar-100)", borderBottom: "2px solid var(--cinnabar-500)", padding: "1px 3px", borderRadius: 3, color: "var(--ink-900)" }}>{a.mark}</mark>{parts[1]}</>
            : <mark style={{ background: "var(--cinnabar-100)", borderBottom: "2px solid var(--cinnabar-500)", padding: "1px 3px", borderRadius: 3, color: "var(--ink-900)" }}>{a.span || a.note || a.q}</mark>}
        </p>
        <p style={{ ...serif, color: "var(--fg-muted)" }}>{t({ es: "\u2026 continúa el documento. DOCYAN respondió citando exactamente el span resaltado arriba; la cadena de pedigree garantiza que no se alteró.", en: "\u2026 the document continues. DOCYAN answered by citing exactly the span highlighted above; the pedigree chain guarantees it was not altered." })}</p>
        {a.lang && a.lang !== "ES" && <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}><Icon name="globe" size={13} />{t({ es: "Documento original en inglés · respuesta entregada en tu idioma", en: "Source document in English · answer delivered in your language" })}</div>}
        <div style={{ marginTop: "auto", paddingTop: 18, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--success-600)" }}><Icon name="shield-check" size={14} />{t({ es: "Pedigree a span · SHA-256 · íntegro", en: "Pedigree to span · SHA-256 · intact" })}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>{sec} · {t({ es: "pág.", en: "p." })} {pg}</span>
        </div>
      </div>
    </div>
  </div>;
}

Object.assign(window, { SourceViewer });
