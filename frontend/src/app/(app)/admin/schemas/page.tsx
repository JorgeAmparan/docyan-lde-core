import { Icon } from "@/components/icon";
import {
  FASES,
  RENDER_LABEL,
  SCHEMAS,
  SCHEMA_ESTADO_META,
  type RenderKind,
} from "@/lib/schemas-catalog";

/**
 * Catálogo normativo de schemas — los 14 tipos documentales cerrados, por fase
 * del ciclo de vida del activo. Espejo VERBATIM del prototipo (SchemasView ·
 * org-views.jsx). DATO DE PRODUCTO canónico (Catálogo Normativo de Schemas v2):
 * no es uso por-tenant simulado, es el catálogo del mercado meta definido por el
 * diseño — legítimo de renderizar tal cual.
 *
 * DOS EJES ORTOGONALES (no confundir):
 *   A) TIPO DOCUMENTAL (esta vista) — qué ontología se extrae según la norma que
 *      rige el documento.
 *   B) RENDER POR INTENCIÓN (pie de tarjeta `render`) — cómo se pinta la respuesta.
 *
 * Línea absoluta: administrativo sí (vencimientos, faltantes, fechas);
 * diagnóstico / decisión clínica-operativa / asesoría legal, jamás.
 */
export default function SchemasPage() {
  const counts = SCHEMAS.reduce<Record<string, number>>((acc, s) => {
    acc[s.estado] = (acc[s.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="schemas-view">
      <div className="wrap">
        <div className="sch-head">
          <div>
            <div className="sh-t">Catálogo normativo de schemas</div>
            <div className="sh-m">
              14 tipos documentales, cerrados, organizados por fase del ciclo de vida del
              activo. Cada schema se deriva de la norma que rige el documento — la ontología
              de extracción es lo que la norma exige, ni más ni menos.
            </div>
          </div>
          <div className="sch-legend">
            {Object.entries(SCHEMA_ESTADO_META).map(([k, m]) => (
              <span className="sl" key={k}>
                <span className={"sev-dot " + m.sev} />
                {m.label} · {counts[k] ?? 0}
              </span>
            ))}
          </div>
        </div>

        <div className="admin-banner" style={{ marginBottom: 18 }}>
          <Icon name="info" size={15} className="lic" />
          Línea absoluta — DOCYAN presenta lo que el documento dice (vencimientos, faltantes,
          fechas: sí). Diagnóstico, decisión clínica/operativa o asesoría legal: jamás. El
          profesional decide.
        </div>

        {FASES.map((f) => {
          const items = SCHEMAS.filter((s) => s.fase === f.key);
          if (!items.length) return null;
          return (
            <div className="sch-fase" key={f.key}>
              <div className="sch-fase-h">
                <Icon name={f.icon} size={15} className="lic" />
                <span className="sf-l">{f.label}</span>
                <span className="sf-q">{f.q}</span>
              </div>
              <div className="sch-grid">
                {items.map((s) => {
                  const est = SCHEMA_ESTADO_META[s.estado];
                  return (
                    <div className={"sch-card " + s.estado} key={s.id}>
                      <div className="sch-card-h">
                        <span className="sc-id">{s.id}</span>
                      </div>
                      <div className="sch-card-h" style={{ marginTop: -4 }}>
                        <span className="sc-l">{s.label}</span>
                        <span className={"badge " + est.sev}>
                          <span className={"sev-dot " + est.sev} />
                          {est.label}
                        </span>
                      </div>
                      <div className="sch-norma">{s.norma}</div>
                      {s.nota && (
                        <div className="sch-nota">
                          {/* prototype uses Lucide's "alert-circle" (renamed to
                              "circle-alert" in this lucide-react version — same glyph). */}
                          <Icon name="circle-alert" size={14} className="lic" />
                          {s.nota}
                        </div>
                      )}
                      <div className="sch-onto">
                        {s.ontologia.map((o, i) => (
                          <span className="onto-chip" key={i}>
                            {o}
                          </span>
                        ))}
                      </div>
                      <div className="sch-foot">
                        {s.render.map((r: RenderKind, i) => (
                          <span className="sf-render" key={i}>
                            <Icon name="layout-template" size={11} className="lic" />
                            {RENDER_LABEL[r] ?? r}
                          </span>
                        ))}
                        <span className="sf-prio">prioridad {s.prioridad}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
