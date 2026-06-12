"use client";

import { Icon } from "@/components/icon";
import { api, ApiError } from "@/lib/api-client";
import { useIngestBatch } from "@/hooks/use-ingest-batch";
import type { DocProgress, DocStatus } from "@/lib/ingesta";

/**
 * Progreso REAL de un documento en ingesta (B13/D6). Sondea
 * `GET /ingesta/documents/{jobId}/status` (vía useIngestBatch, un solo job) y
 * muestra estados HONESTOS: encolado / cargando / procesando / completado / error
 * con su causa. Si el worker rechaza, el usuario lo ve aquí — y puede reintentar.
 * No finge progreso: el pct/fase los calcula el backend.
 */
const STATUS_LABEL: Record<DocStatus, string> = {
  encolado: "En cola de procesamiento",
  cargando: "Cargando documento",
  procesando: "Procesando — leyendo y construyendo el grafo",
  completado: "Listo. Documento vivo.",
  error: "No se pudo procesar",
};

const PHASE_LABEL: Record<string, string> = {
  descarga: "descarga",
  conversion: "conversión",
  extraccion: "extracción",
  grafo: "grafo de conocimiento",
  dedup: "consolidación",
};

export function IngestProgressRow({
  jobId,
  name,
  token,
  onCompleted,
  onError,
}: {
  jobId: string | null;
  name?: string | null;
  token?: string | null;
  onCompleted?: (doc: DocProgress) => void;
  onError?: (doc: DocProgress) => void;
}) {
  const { byId } = useIngestBatch(jobId ? [jobId] : [], {}, {
    token,
    onDocCompleted: onCompleted,
    onDocError: onError,
  });
  const d = jobId ? byId[jobId] : undefined;

  if (!jobId) return null;

  const status: DocStatus = d?.status ?? "encolado";
  const pct = d?.status === "completado" ? 100 : Math.round(d?.pct ?? 0);
  const docName = d?.name ?? name ?? "Documento";

  const retry = async () => {
    try {
      await api.post(`/ingesta/documents/${jobId}/retry`, undefined, { token });
    } catch (e) {
      // El backend rechaza un retry no aplicable (409): el estado actual ya lo refleja.
      if (!(e instanceof ApiError)) throw e;
    }
  };

  const isError = status === "error";
  // B13.3 fix: "vivo" = el grafo lo confirma (disponibleParaConsulta), NO solo el
  // estado del job. Un job "completado" SIN :DocumentoSource (completedSinDocumento)
  // NO está vivo — se muestra honesto + reintentar, jamás "vivo" en silencio.
  const completado = status === "completado";
  const vivo = completado && d?.disponibleParaConsulta === true;
  const sinDoc = completado && !vivo; // procesado pero no quedó vivo
  const done = vivo;
  const label = sinDoc
    ? "Procesado, pero no quedó vivo. Reintenta la carga."
    : STATUS_LABEL[status];

  return (
    <div className={"ingest-row" + (isError || sinDoc ? " err" : done ? " done" : "")}>
      <span className="ir-ic">
        <Icon
          name={isError || sinDoc ? "triangle-alert" : done ? "check-circle-2" : "loader-2"}
          size={18}
          style={!isError && !sinDoc && !done ? { animation: "spin 1s linear infinite" } : undefined}
        />
      </span>
      <div className="ir-main">
        <div className="ir-n">{docName}</div>
        <div className="ir-m">
          {label}
          {d?.phase && !done && !isError && !sinDoc ? ` · ${PHASE_LABEL[d.phase] ?? d.phase}` : ""}
          {status === "encolado" && d?.queuePosition ? ` · posición ${d.queuePosition}` : ""}
        </div>
        {!done && !isError && !sinDoc && (
          <span className="opbar" style={{ marginTop: 8, display: "block" }}>
            <i style={{ width: pct + "%" }} />
          </span>
        )}
        {isError && d?.error?.message && (
          <p className="warn" role="alert" style={{ marginTop: 6 }}>
            {d.error.message}
          </p>
        )}
      </div>
      {!done && !isError && !sinDoc && <span className="ir-pct mono">{pct}%</span>}
      {(isError || sinDoc) && (
        <button className="btn sec" onClick={retry} type="button">
          <Icon name="refresh-cw" size={15} />
          Reintentar
        </button>
      )}
    </div>
  );
}
