/**
 * Catálogo de TIPOS DOCUMENTALES para la corrección de tipo en el cotizador.
 *
 * Espejo del catálogo del mercado meta del design system (schemas.jsx). El valor
 * `id` es el que viaja al backend como `tipo_forzado` en `POST /ingesta/documents`
 * (re-cotización con el tipo corregido por el usuario — regla transversal #1).
 *
 * `estado` refleja la madurez del schema de extracción:
 *   - "activo": schema dedicado liberado (6 tipos reales del catálogo backend).
 *   - "parcial": existe, pendiente de refinar/subdividir.
 *   - "falta": sin schema dedicado aún → extracción genérica + aviso honesto.
 *
 * Honestidad: el backend solo tiene schema dedicado para los 6 tipos `activo`/
 * `parcial` que coinciden con `app/schemas_documentales/catalogo/`. Los demás son
 * tipos válidos del mercado meta sin schema optimizado: forzarlos es legítimo, y
 * el worker genera el schema al vuelo (lo que la tarjeta avisa con `cot-notice gen`).
 */
export type DocTypeEstado = "activo" | "parcial" | "falta";

/** Severidad visual del punto (sev-dot) por estado del schema. */
export type DocTypeSev = "ok" | "caution" | "warn";

export interface DocType {
  /** id enviado como `tipo_forzado`. Los 6 primeros coinciden con el catálogo backend. */
  id: string;
  label: string;
  estado: DocTypeEstado;
}

/** Etiqueta + severidad por estado (espejo de ESTADO_META del design system). */
export const ESTADO_META: Record<DocTypeEstado, { label: string; sev: DocTypeSev }> = {
  activo: { label: "Activo", sev: "ok" },
  parcial: { label: "Parcial", sev: "caution" },
  falta: { label: "Por construir", sev: "warn" },
};

/**
 * Los 14 tipos del mercado meta (espejo de SCHEMAS en el design system). Los que
 * tienen schema dedicado en el backend usan el id del catálogo
 * (`calibracion`, `msds`, `especificacion`, `ficha_tecnica`, `manual_tecnico`);
 * el resto, ids del design system (válidos como `tipo_forzado`, sin schema
 * optimizado → el worker lo genera).
 */
export const DOC_TYPES: DocType[] = [
  { id: "ficha_tecnica", label: "Ficha técnica", estado: "activo" },
  { id: "especificacion", label: "Especificación de ingeniería", estado: "activo" },
  { id: "calibracion", label: "Certificado de calibración", estado: "activo" },
  { id: "msds", label: "Hoja de seguridad (SDS/MSDS)", estado: "activo" },
  { id: "manual_tecnico", label: "Manual de operación", estado: "parcial" },
  { id: "manual_mantenimiento", label: "Manual de mantenimiento", estado: "parcial" },
  { id: "instructivo", label: "Instructivo de producto", estado: "falta" },
  { id: "manual_instalacion", label: "Manual de instalación", estado: "falta" },
  { id: "instruccion_trabajo", label: "Instrucción de trabajo", estado: "falta" },
  { id: "plan_control", label: "Plan de control", estado: "falta" },
  { id: "protocolo_inspeccion", label: "Protocolo de inspección", estado: "falta" },
  { id: "norma_ley_reglamento", label: "Norma / ley / reglamento", estado: "falta" },
  { id: "registro_historico", label: "Registro histórico / bitácora", estado: "falta" },
  { id: "memoria_traduccion", label: "Memoria de traducción", estado: "falta" },
];

const BY_ID = new Map(DOC_TYPES.map((d) => [d.id, d]));

/** Tipo conocido por id (admite también el label crudo del backend). */
export function docTypeById(id?: string | null): DocType | undefined {
  if (!id) return undefined;
  const direct = BY_ID.get(id);
  if (direct) return direct;
  // El backend puede devolver el label legible ("manual técnico"); normaliza.
  const norm = id.toLowerCase().trim();
  return DOC_TYPES.find(
    (d) => d.label.toLowerCase() === norm || d.id === norm.replace(/\s+/g, "_"),
  );
}
