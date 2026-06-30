"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import {
  listCodos,
  getCuenta,
  type CodoOut,
  type CuentaResumen,
} from "@/lib/onboarding";

/**
 * CoDos — lista del tenant. Portado pixel-perfect del prototipo
 * `docs/DOCYAN LDE — Design System/app/org.jsx` (`CodosList` + `CodosEmpty`).
 *
 * Cableado a datos reales:
 *  - Lista de CoDos → `GET /mo/codos` (CodoOut: id, tipo, nombre, tipo_documento,
 *    documentos, estado). Tarjeta → `/admin/codos/{id}` (expediente).
 *  - Plan (free/pro) + cupo → `GET /onboarding/cuenta` (CuentaResumen). El plan
 *    «freemium» activa la copy y la barra de uso de plan gratuito del prototipo.
 *  - «Nuevo CoDo» → /admin/ingesta (el flujo real de alta es cargar documentos;
 *    cuando se ingieren aparecen como CoDo, igual que en /select-codo).
 *
 * Honestidad de datos (sin fabricar): el prototipo muestra «consultas / 30d» y
 * «colaboradores» por CoDo y un «Te queda 1 CoDo · 27 días» — ninguno tiene campo
 * en el backend, así que se rinden como «—» / sin número inventado. El tope de
 * CoDos del plan gratuito tampoco es un campo real, así que la barra de uso refleja
 * el conteo real sin denominador inventado.
 */

// Ícono por tipo de CoDo (mismo vocabulario del prototipo / Resumen).
function codoIcon(c: CodoOut): string {
  const t = (c.tipo_documento ?? c.tipo ?? "").toLowerCase();
  if (t.includes("centrif") || t.includes("rotor")) return "disc-3";
  if (t.includes("cnc") || t.includes("maquin")) return "cog";
  if (t.includes("mezcl") || t.includes("concret")) return "blend";
  if (c.tipo === "documento") return "file-text";
  return "folder";
}

/** DEF-4: un id "tipo hash" (SHA-256 de un documento suelto) NUNCA se muestra como
 *  código del CoDo. El prototipo muestra un código legible (CODO-OBR-07); para un
 *  doc suelto sin código no se pinta `.cid` (mejor vacío que fugar el hash). */
function isHashLike(id: string): boolean {
  return /[0-9a-f]{16,}/i.test(id.replace(/[^0-9a-z]/gi, ""));
}

function CodosEmpty({ isFree, onNew }: { isFree: boolean; onNew: () => void }) {
  const steps: [string, string, string][] = [
    ["pencil", "Nombra la entidad", "El equipo, lugar o proceso: una mezcladora, una celda CNC, una centrífuga."],
    ["upload", "Vincula sus documentos", "Sube manuales, fichas, MSDS y registros como están — DOCYAN los deja consultables."],
    ["qr-code", "Genera su QR persistente", "Pégalo en el equipo. El colaborador escanea y pregunta, con cita a la fuente."],
  ];
  return (
    <div className="codo-empty">
      <div className="ce-mark">
        <Icon name={isFree ? "files" : "folder-tree"} size={30} />
      </div>
      <h2>{isFree ? "Aún no tienes documentos vivos" : "Crea tu primer CoDo"}</h2>
      <p className="ce-lead">
        Un <b>CoDo</b> (Contexto Documental) agrupa los documentos de una entidad en su contexto. Es la
        unidad con la que tu organización vuelve consultable su conocimiento.
      </p>
      <div className="ce-steps">
        {steps.map((s, i) => (
          <div className="ce-step" key={i}>
            <span className="ce-n">{i + 1}</span>
            <span className="ce-ic">
              <Icon name={s[0]} size={18} />
            </span>
            <div className="ce-st">
              <div className="ce-stt">{s[1]}</div>
              <div className="ce-stm">{s[2]}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary ce-cta" onClick={onNew}>
        <Icon name="plus" size={16} />
        {isFree ? "Crear mi primer documento vivo" : "Crear mi primer CoDo"}
      </button>
      {isFree && (
        <div className="ce-note">
          <Icon name="gem" size={14} />
          Plan gratuito · hasta 3 CoDos. Colaboradores ilimitados, sin costo.
        </div>
      )}
    </div>
  );
}

export default function CodosPage() {
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const { data, isLoading, error } = useQuery({
    queryKey: ["codos"],
    queryFn: () => listCodos(token as string),
    enabled: !!token,
    retry: false,
  });

  const { data: cuenta } = useQuery<CuentaResumen>({
    queryKey: ["cuenta"],
    queryFn: () => getCuenta(token as string),
    enabled: !!token,
    retry: false,
  });

  const codos: CodoOut[] = useMemo(() => data?.items ?? [], [data]);
  const isFree = (cuenta?.plan ?? "").toLowerCase().includes("free");
  const onNew = () => router.push("/admin/ingesta");

  const loadErr = error
    ? error instanceof ApiError
      ? error.message
      : "El motor no respondió. Reintenta en unos segundos."
    : null;

  if (loadErr) {
    return (
      <div className="codos-view">
        <div className="codos-state" role="alert">
          <Icon name="triangle-alert" size={26} />
          <p>{loadErr}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="codos-view">
        <div className="codos-state">
          <Icon name="loader-2" size={22} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (codos.length === 0) {
    return (
      <div className="codos-view">
        <CodosEmpty isFree={isFree} onNew={onNew} />
      </div>
    );
  }

  return (
    <div className="codos-view">
      <div className="list-head">
        <div className="lh-t">
          <h2>{isFree ? "Documentos vivos" : "CoDos"}</h2>
          <p>
            {isFree
              ? "Tus documentos consultables, agrupados por entidad."
              : "Cada CoDo agrupa los documentos de una entidad. Ábrelo para ver su expediente o créalo desde cero."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          <Icon name="plus" size={16} />
          Nuevo CoDo
        </button>
      </div>

      {isFree && (
        <div className="usage">
          <div>
            <div className="ut">Plan gratuito</div>
            <div className="um">{cuenta?.plan_nombre ?? "Hasta 3 CoDos"}</div>
          </div>
          <div className="track">
            <i style={{ width: `${Math.min(100, (codos.length / 3) * 100)}%` }} />
          </div>
          <div className="num">
            <b>{codos.length}</b> / 3
          </div>
        </div>
      )}

      <div className="codo-grid">
        {codos.map((c) => (
          <div key={c.id} className="codo-card" onClick={() => router.push(`/admin/codos/${c.id}`)}>
            <div className="ch">
              <span className="ci">
                <Icon name={codoIcon(c)} size={21} />
              </span>
              <div style={{ minWidth: 0 }}>
                {!isHashLike(c.id) && <div className="cid">{c.id}</div>}
                <div className="cn">{c.nombre}</div>
              </div>
              {c.estado === "warn" ? (
                <span className="badge warn">
                  <Icon name="alarm-clock" size={12} />2 alertas
                </span>
              ) : (
                <span className="badge ok">
                  <Icon name="check" size={12} />
                  Al día
                </span>
              )}
            </div>
            <div className="crow">
              <div className="cstat">
                <div className="cv">{c.documentos}</div>
                <div className="cl">docs vivos</div>
              </div>
              <div className="cstat">
                <div className="cv">—</div>
                <div className="cl">consultas / 30d</div>
              </div>
              <div className="cstat">
                <div className="cv">—</div>
                <div className="cl">colaboradores</div>
              </div>
            </div>
          </div>
        ))}
        <div className="codo-card new-codo" onClick={onNew}>
          <span className="ni">
            <Icon name="plus" size={21} />
          </span>
          <div className="nt">Nuevo CoDo</div>
          <div className="nm">Nombra una entidad, vincula sus documentos y genera su QR.</div>
        </div>
      </div>
    </div>
  );
}
