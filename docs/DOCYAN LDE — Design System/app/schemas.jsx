/* DOCYAN — Modelo canónico de SCHEMAS DOCUMENTALES + ECONOMÍA DE INGESTA.
   ───────────────────────────────────────────────────────────────────────────
   FUENTE DE VERDAD para la implementación (Opus / VS Code). Derivado de:
     · Catálogo Normativo de Schemas v2 — 14 tipos por fase del ciclo de vida.
     · Modelo Comercial Canónico v1.1 — cupo de ingestas + fórmula de setup.
     · Repo docyan-lde-core — cotizador.py · quota_manager.py · pricing_table.py
       · schemas_documentales/ · ingesta.py.

   DOS EJES ORTOGONALES (no confundir):
     A) TIPO DOCUMENTAL (este archivo, SCHEMAS) — qué ontología se extrae según
        la norma que rige el documento. 14 tipos cerrados.
     B) RENDER POR INTENCIÓN (answers.jsx) — cómo se pinta una respuesta.
        Relación muchos-a-muchos: un tipo asigna 1..n renders (campo `render`).

   Línea absoluta (cruza todo): administrativo sí (vencimientos, faltantes);
   diagnóstico / decisión clínica-operativa / asesoría legal, jamás.
   ─────────────────────────────────────────────────────────────────────────── */

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  1 · ECONOMÍA DE INGESTA  (Modelo Comercial Canónico v1.1)              ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

/* Precios públicos vigentes de los modelos (USD por 1M de tokens). pricing_table.py */
const PRICING = {
  asOf: "2026-05-28",
  geminiFlash: { in: 0.30, out: 2.50 },   // extracción / resolución
  gpt4oMini:   { in: 0.15, out: 0.60 },   // QA / consulta
  bgeM3PerM:   0.01,                        // embeddings self-host (cómputo propio)
};

/* Modelo de uso del pipeline: por cada token de documento, cuántos factura cada fase.
   Calibrado contra baselines del PoC (NOM 32pp ≈ $0.036). pricing_table.py */
const USAGE = {
  extractionIn: 1.0, extractionOut: 0.5,
  qaIn: 0.3, qaOut: 0.1,
  secondsPer1kTokens: 642.0 / 22.4,        // ≈ 28.7 s/1k (PoC NOM 32pp ≈ 22.4k tok)
};

/* Cupo de ingestas incluido por tier (setup $0 dentro del cupo). quota_manager.py
   [cupoInicial mes 1, cupoRecurrenteMensual]. Enterprise = negociado. */
const TIERS = {
  freemium:    { label: "Gratuito",     cupo: null,      docLimit: 3,    ventanaDias: 30, saldoCortesiaUsd: 2.0 },
  esencial:    { label: "Esencial",     cupo: [10, 3],   docLimit: 50 },
  profesional: { label: "Profesional",  cupo: [30, 10],  docLimit: null /* ilimitado */ },
  enterprise:  { label: "Enterprise",   cupo: null /* negociado */, docLimit: null, negociado: true },
  piloto:      { label: "Piloto",       cupo: [10, 3],   docLimit: 50, descuento: 0.30, ventanaDias: 60 }, // Esencial −30%
};

/* Fórmula de cobro de setup — SOLO al excedente del cupo. pricing_table.precio_setup
   precio = MAX(piso, costo_base_real × multiplicador) × factor_complejidad
   Para casi todo gana el PISO ($15); solo documentos monstruosos activan ×25. */
const SETUP = { pisoUsd: 15.0, multiplicador: 25.0, factorComplejidad: 1.0 };

/* Ciclo de vida de impago (Modelo Comercial §4). Días desde el vencimiento. */
const LIFECYCLE = {
  graciaDias: 7,            // entorno funcional, recordatorios
  suspensionDias: 60,       // dormido, datos a salvo (acumula a 67)
  cancelacionDia: 67,       // eliminación del contenido consultable
  retencionFatAnios: 7,     // el rastro auditable se retiene aunque se cancele
};

/* Cobro: manual durante el piloto; Stripe tras 3-5 clientes (Modelo Comercial §5.3). */
const COBRO = { modo: "manual", proveedorDiferido: "stripe", metodoDefault: "Visa ···· 4421" };

/* costo_base_real (USD) de un documento a partir de sus tokens estimados (tiktoken). */
function costoBase(tokens) {
  const m = (n) => n / 1_000_000;
  const extr = m(tokens * USAGE.extractionIn) * PRICING.geminiFlash.in
             + m(tokens * USAGE.extractionOut) * PRICING.geminiFlash.out;
  const qa   = m(tokens * USAGE.qaIn) * PRICING.gpt4oMini.in
             + m(tokens * USAGE.qaOut) * PRICING.gpt4oMini.out;
  const emb  = m(tokens) * PRICING.bgeM3PerM;
  return extr + qa + emb;
}
/* precio de setup del excedente (gana el piso salvo documentos caros). */
function precioSetup(costoBaseReal, factor) {
  const f = factor == null ? SETUP.factorComplejidad : factor;
  return Math.round(Math.max(SETUP.pisoUsd, costoBaseReal * SETUP.multiplicador) * f * 100) / 100;
}
function tiempoSegPorTokens(tokens) { return Math.round(tokens / 1000 * USAGE.secondsPer1kTokens); }

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  2 · FASES DEL CICLO DE VIDA  (eje organizador del catálogo)            ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */
const FASES = [
  { key: "identidad",   label: "Identidad / especificación", q: "¿qué es, qué características tiene?", icon: "file-text" },
  { key: "instalacion", label: "Instalación",                q: "¿cómo se instala / configura?",       icon: "wrench" },
  { key: "operacion",   label: "Operación",                  q: "¿cómo se usa / opera?",                icon: "play" },
  { key: "manten",      label: "Mantenimiento",              q: "¿cómo se mantiene / repara, cada cuánto?", icon: "settings" },
  { key: "calibracion", label: "Calibración / verificación", q: "¿está calibrado, hasta cuándo, con qué trazabilidad?", icon: "ruler" },
  { key: "calidad",     label: "Calidad / inspección",       q: "¿qué se controla, con qué criterio?",  icon: "shield-check" },
  { key: "seguridad",   label: "Seguridad",                  q: "¿qué peligros, qué protección?",       icon: "shield-alert" },
  { key: "normativo",   label: "Normativo",                  q: "¿qué exige la ley / norma?",           icon: "scale" },
  { key: "historico",   label: "Histórico / registro",       q: "¿qué ha pasado en el tiempo?",         icon: "history" },
  { key: "linguistico", label: "Activo lingüístico",         q: "¿equivalente de término, segmento previo?", icon: "languages" },
];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  3 · LOS 14 TIPOS DOCUMENTALES (cerrados)                               ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   estado:  activo  → schema liberado y funcionando en el repo.
            parcial → existe pero pendiente de refinar / subdividir.
            falta   → schema por construir (entra como extracción genérica + aviso).
   render:  keys de answer-kind de answers.jsx (info · steps · alerts · history · bilingual).
   prioridad: orden de implementación aprobado (Catálogo §Prioridad). */
const SCHEMAS = [
  { id: "ficha_tecnica", fase: "identidad", label: "Ficha técnica", estado: "activo", prioridad: 5,
    audiencia: "Usuario / técnico",
    norma: "Hoja del fabricante · ASTM/ISO de materiales según producto.",
    ontologia: ["Especificacion (parámetro→valor→unidad→tolerancia)", "Condiciones de prueba", "NormaReferencia"],
    render: ["info"],
    consultas: ["¿valor de X?", "¿tolerancia?", "¿bajo qué norma?"] },

  { id: "especificacion", fase: "identidad", label: "Especificación de ingeniería", estado: "activo", prioridad: 5,
    audiencia: "Ingeniería / calidad",
    norma: "Especificación de ingeniería · ISO/ASTM del dominio.",
    ontologia: ["Especificacion (requisito)", "Característica (crítica/significativa)", "Método de verificación", "Norma aplicable"],
    render: ["info"],
    consultas: ["¿requisito de X?", "¿cómo se verifica?", "¿es característica crítica?"] },

  { id: "instructivo", fase: "instalacion", label: "Instructivo de producto", estado: "falta", prioridad: 4,
    audiencia: "Usuario final",
    norma: "IEC/IEEE 82079-1 · NOM-018-STPS · NOM-024-SCFI (instructivos y garantías, MX).",
    ontologia: ["Procedimiento→Paso (uso/instalación)", "Advertencia", "Requisito previo", "Símbolos de seguridad"],
    render: ["steps"],
    consultas: ["¿cómo se configura / instala?", "¿qué advertencia aplica?", "¿qué requiere antes de usar?"] },

  { id: "manual_instalacion", fase: "instalacion", label: "Manual de instalación", estado: "falta", prioridad: 4,
    audiencia: "Equipo de instalación",
    norma: "Fabricante + NOM de instalación del dominio (NOM-001-SEDE eléctrica, gas, etc.).",
    ontologia: ["Especificacion (tolerancias, anclajes)", "Procedimiento→Paso", "Requisitos de sitio/servicios", "Advertencia", "Herramienta"],
    render: ["info", "steps"],
    consultas: ["¿qué requisitos de sitio?", "¿cómo se ancla / conecta?", "¿qué tolerancia de instalación?"] },

  { id: "manual_operacion", fase: "operacion", label: "Manual de operación", estado: "parcial", prioridad: 1,
    audiencia: "Operador / técnico",
    norma: "Fabricante + IEC 82079-1 · residual-risk warnings (directiva de maquinaria).",
    nota: "Subdivisión de manual_tecnico (hoy un solo tipo en el repo). Prioridad 1.",
    ontologia: ["Especificacion (rangos, capacidades)", "Procedimiento→Paso (operación)", "Advertencia / riesgo residual", "Controles / indicadores"],
    render: ["info", "steps"],
    consultas: ["¿rango / capacidad?", "¿cómo se opera X?", "¿qué significa el indicador Y?"] },

  { id: "manual_mantenimiento", fase: "manten", label: "Manual de mantenimiento", estado: "parcial", prioridad: 1,
    audiencia: "Técnico de mantenimiento",
    norma: "Fabricante + O&M (MIMOSA/ISO 14224) · satisface OSHA/ISO de registros.",
    nota: "Subdivisión de manual_tecnico. Prioridad 1. Troubleshooting = SOLO como lo dice el manual, jamás diagnóstico del caso (línea absoluta).",
    ontologia: ["FechaVencimiento / intervalo (→alertas)", "Procedimiento→Paso (preventivo/correctivo)", "Componente (lubricación/insumos)", "Troubleshooting síntoma→causa→acción (del manual)", "Herramienta", "Refacción"],
    render: ["steps", "alerts", "info", "troubleshoot"],
    consultas: ["¿cada cuánto mantenimiento?", "¿cómo se repara X?", "¿qué dice el manual del síntoma Y?", "¿qué refacción usa?"] },

  { id: "instruccion_trabajo", fase: "operacion", label: "Instrucción de trabajo", estado: "falta", prioridad: 4,
    audiencia: "Operador en piso, punto de uso",
    norma: "SGC del cliente — ISO 9001 §7.5 + IATF 16949 + NOM-018 seguridad.",
    ontologia: ["Procedimiento→Paso (tarea)", "Responsable / rol por paso", "EquipoProteccion por paso", "Especificacion (criterio de aceptación)", "Registros requeridos", "Documento padre / versión"],
    render: ["steps"],
    consultas: ["¿cómo se hace esta tarea?", "¿quién es responsable?", "¿qué EPP exige?", "¿criterio de aceptación?"] },

  { id: "certificado_calibracion", fase: "calibracion", label: "Certificado de calibración", estado: "activo", prioridad: 1,
    audiencia: "Metrología / calidad",
    norma: "ISO/IEC 17025:2017 §7.8 · trazabilidad CENAM / acreditación EMA (MX).",
    ontologia: ["Instrumento (marca/modelo/serie)", "MedicionRegistrada (nominal/medido/desviación)", "Especificacion (incertidumbre + factor k)", "TrazabilidadPatron (NIST/CENAM)", "FechaVencimiento / CertificadoVigencia", "Responsable (firmante)"],
    render: ["info", "alerts"],
    consultas: ["¿cuándo vence?", "¿trazable a qué patrón?", "¿incertidumbre?", "¿desviación en X punto?"] },

  { id: "plan_control", fase: "calidad", label: "Plan de control", estado: "falta", prioridad: 3,
    audiencia: "Calidad / manufactura",
    norma: "IATF 16949 + manual AIAG (Control Plan) · APQP.",
    nota: "Cruce con calibración: instrumento referenciado ↔ certificado vigente (oro para el lab embajador).",
    ontologia: ["Operación / proceso", "Característica con clasificación", "Especificacion (+tolerancia)", "Instrumento (cruce con calibración)", "Frecuencia de inspección", "Plan de reacción (Procedimiento)"],
    render: ["info", "alerts"],
    consultas: ["¿qué se mide en operación X?", "¿con qué instrumento / frecuencia?", "¿tolerancia?", "¿plan de reacción?"] },

  { id: "protocolo_inspeccion", fase: "calidad", label: "Protocolo de inspección", estado: "falta", prioridad: 5,
    audiencia: "Inspección / calidad",
    norma: "ISO 17020 (organismos de inspección) / protocolos del SGC · checklists.",
    ontologia: ["PuntoInspeccion", "Especificacion (criterio aceptación/rechazo)", "Método / instrumento", "Frecuencia", "Registro de resultado"],
    render: ["info", "steps"],
    consultas: ["¿qué se inspecciona?", "¿criterio de aceptación?", "¿con qué método?"] },

  { id: "hoja_seguridad", fase: "seguridad", label: "Hoja de seguridad (SDS/MSDS)", estado: "activo", prioridad: 1,
    audiencia: "Operador / EHS",
    norma: "GHS 16 secciones / NOM-018-STPS-2015. Cubre GHS y pre-GHS (hojas viejas ES).",
    nota: "Datos negativos explícitos se extraen como datos (\"punto de inflamación: NINGUNO\") — freno de alucinación. Filtra nombres genéricos (\"El Material\").",
    ontologia: ["Sustancia (comercial/químico/NumeroCAS)", "Componente (% composición)", "Riesgo (categorías GHS)", "Procedimiento (primeros auxilios)", "Especificacion (PEL/TLV/IDLH)", "EquipoProteccion", "Propiedades físicas", "MedidaProteccion"],
    render: ["info", "steps"],
    consultas: ["¿cómo se llama el químico?", "¿PEL?", "¿punto de inflamación?", "¿EPP?", "¿qué hago si derrame?"] },

  { id: "norma_ley_reglamento", fase: "normativo", label: "Norma / ley / reglamento", estado: "falta", prioridad: 2,
    audiencia: "Cumplimiento / legal",
    norma: "Estructura jurídico-normativa: títulos→capítulos→artículos→fracciones→incisos→transitorios (MX); 29 CFR (OSHA); cláusulas (ISO/NOM).",
    nota: "Habilita el Acervo Normativo precargado (tenant común de solo lectura). Render lleva descargo obligatorio: texto de la norma, no asesoría legal.",
    ontologia: ["Articulo / Clausula (número, texto, jerarquía)", "Obligacion (con sujeto)", "TerminoTecnico (definiciones)", "REFERENCIA_NORMATIVA (cruzadas)", "Vigencia / reformas (fecha DOF)", "Ámbito"],
    render: ["info"],
    consultas: ["¿qué dice el artículo X?", "¿qué obliga a [sujeto]?", "¿cómo define [término]?", "¿vigente?"] },

  { id: "registro_historico", fase: "historico", label: "Registro histórico / bitácora", estado: "falta", prioridad: 6,
    audiencia: "Operación / calidad",
    norma: "ISO 17025 (registros) / retención del SGC · bitácoras O&M.",
    nota: "Tendencia SOLO como datos presentados (frecuencia-sí / causa-no): muestra la serie citada, jamás \"se está degradando\".",
    ontologia: ["EventoOperativo (serie fechada)", "Activo asociado", "Resultado por evento"],
    render: ["history"],
    consultas: ["¿última / próxima calibración?", "¿historial del activo X?"] },

  { id: "memoria_traduccion", fase: "linguistico", label: "Memoria de traducción", estado: "falta", prioridad: 6,
    audiencia: "Agencias / lingüístico (Pista B)",
    norma: "Formatos CAT: TMX / XLIFF / TBX / SDLXLIFF / Bilingual DOCX.",
    nota: "Conecta con el sprint de lock terminológico (L2+L3). PTM segregada estricta por par lingüístico.",
    ontologia: ["Segmento origen↔destino (por par lingüístico)", "Término↔equivalente (lock terminológico)", "Metadatos de proyecto"],
    render: ["bilingual"],
    consultas: ["¿equivalente de término X?", "¿segmento previo de Y?"] },
];

const SCHEMA_BY_ID = Object.fromEntries(SCHEMAS.map(s => [s.id, s]));
const ESTADO_META = {
  activo:  { label: "Activo",   sev: "ok",      desc: "Schema liberado y funcionando." },
  parcial: { label: "Parcial",  sev: "caution", desc: "Existe; pendiente de refinar / subdividir." },
  falta:   { label: "Por construir", sev: "warn", desc: "Sin schema aún → extracción genérica + aviso honesto." },
};

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  4 · COTIZACIÓN DEMO — lote MAXI-10ND, tenant Profesional               ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Reglas transversales en juego:
     #1 tipo declarado = tipo real → el clasificador asigna, el cotizador muestra,
        el usuario corrige (tipoForzado) antes de aprobar.
     #2 tipo sin schema → extracción genérica + aviso honesto pre-ingesta.
   resuelto: "heuristica" | "usuario" | "worker_generara"
   cupo:     true = incluido en el plan ($0) · false = excedente (fórmula). */
const CUPO_DEMO = { tier: "profesional", restante: 2, recurrente: 10, inicial: 30 }; // 2 incluidas restantes este mes

function _cot(d) {
  const cb = costoBase(d.tokens);
  const excedente = !d.cupo;
  return {
    ...d,
    costoBaseUsd: Math.round(cb * 10000) / 10000,
    precioSetupUsd: excedente ? precioSetup(cb) : 0,
    tiempoSeg: tiempoSegPorTokens(d.tokens),
    excedente,
  };
}
const COTIZACIONES = [
  _cot({ id: "c1", name: "Instrucciones de operación — MAXI-10ND", fmt: "PDF", pages: 12, mb: 1.2, tokens: 6200,
    tipo: "manual_operacion", resuelto: "heuristica", confianza: 0.92, cupo: true }),
  _cot({ id: "c2", name: "Lista de partes — MAXI-10ND", fmt: "PDF", pages: 17, mb: 1.6, tokens: 8400,
    tipo: "ficha_tecnica", resuelto: "heuristica", confianza: 0.88, cupo: true }),
  _cot({ id: "c3", name: "Ficha técnica — MAXI-10ND", fmt: "PDF · OCR", pages: 1, mb: 0.3, tokens: 520,
    tipo: "ficha_tecnica", resuelto: "heuristica", confianza: 0.95, cupo: false }),
  _cot({ id: "c4", name: "NOM-018-STPS — pictogramas", fmt: "PDF escaneado", pages: 12, mb: 0.7, tokens: 5900,
    tipo: "norma_ley_reglamento", resuelto: "heuristica", confianza: 0.61, cupo: false, ocr: true }),
];

/* Fases del worker al ingerir (progreso). org-views IngestBatch las consume. */
const INGEST_PHASES = ["Descarga", "Conversión", "Extracción", "Escritura a grafo", "Deduplicación"];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  5 · GLOSARIO TERMINOLÓGICO + LOCK  (Lock Terminológico Canónico)       ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   El lock es función del ENTORNO DE CONSULTA (MVP, no Nivel 4): impone el término
   gobernado como restricción DURA sobre el modelo antes de generar el render
   asistido. No es CAT tool, no es sugerencia verbal, no certifica traducción.

   Tres orígenes de las entradas (§1b):
     publico → glosario público (NOM Anillo 1, texto DOF, sembrable).
     grafo   → entidad que el grafo ya extrajo al ingerir (reutiliza ingesta).
     cliente → nomenclatura interna validada por el cliente = FOSO (Nivel 3).
   Anillo (§5): 1 = NOM pública sembrable · 2 = ISO/IATF licenciada, confinada al tenant.
   Obligatoriedad (§4): shall/must → obligación · should → recomendación · may → permiso.
     NUNCA colapsar (shall≠should): cambia el significado regulatorio. */
const GLOSARIO_PAR = { src: "EN-US", tgt: "ES-MX", label: "Inglés → Español (MX)" };

const GLOSARIO_ORIGEN = {
  publico: { label: "Público", sev: "info",    desc: "Glosario público — NOM Anillo 1 (DOF)." },
  grafo:   { label: "Del grafo", sev: "caution", desc: "Entidad extraída al ingerir el documento." },
  cliente: { label: "Validado por el cliente", sev: "ok", desc: "Nomenclatura interna del tenant — activo propietario." },
};
const OBLIGATORIEDAD = {
  shall:  { label: "shall · obligación", sev: "warn", regla: "→ deberá / debe · NUNCA 'debería'" },
  must:   { label: "must · obligación",  sev: "warn", regla: "→ deberá / debe · NUNCA 'debería'" },
  should: { label: "should · recomendación", sev: "caution", regla: "→ debería / se recomienda" },
  may:    { label: "may · permiso",      sev: "info", regla: "→ puede / podrá" },
};

/* Entradas del glosario. `variantes` = conjunto (§2), cada una con su ORIGEN
   propio (§1b: publico/grafo/cliente). `canonica` = la elegida por el tenant
   (el lock la impone consistente). El usuario puede AGREGAR su término propio
   (→ origen cliente, el foso) y RENOMBRAR una sugerida (renombrar = localizar =
   pasa a ser validada por el cliente). `modal` = categoría de obligatoriedad. */
const GLOSARIO = [
  { id: "g1", src: "torque",
    variantes: [{ t: "par de apriete", o: "cliente" }, { t: "torsión", o: "publico" }, { t: "torque", o: "grafo" }],
    canonica: "par de apriete", dom: "Norma mecánica", anillo: 2, modal: null,
    cite: "Manual VF-2 · §4.2 · la planta usa 'par de apriete'" },
  { id: "g2", src: "shall",
    variantes: [{ t: "deberá", o: "publico" }, { t: "debe", o: "publico" }],
    canonica: "deberá", dom: "Regulatorio", anillo: 1, modal: "shall",
    cite: "NOM-018-STPS-2015 · cláusula de obligación" },
  { id: "g3", src: "should",
    variantes: [{ t: "debería", o: "publico" }, { t: "se recomienda", o: "publico" }],
    canonica: "debería", dom: "Regulatorio", anillo: 1, modal: "should",
    cite: "ISO/IEC 82079-1 · recomendación" },
  { id: "g4", src: "may",
    variantes: [{ t: "puede", o: "publico" }, { t: "podrá", o: "publico" }],
    canonica: "puede", dom: "Regulatorio", anillo: 1, modal: "may",
    cite: "NOM-018-STPS-2015 · permiso" },
  { id: "g5", src: "flammable: NONE",
    variantes: [{ t: "no inflamable", o: "grafo" }, { t: "ninguno (no inflamable)", o: "grafo" }],
    canonica: "no inflamable", dom: "MSDS / Seguridad", anillo: 1, modal: null, critico: true,
    cite: "SDS MAXI · §9 · dato negativo explícito — no colapsar a 'inflamable'" },
  { id: "g6", src: "lock-out/tag-out",
    variantes: [{ t: "bloqueo/etiquetado (LOTO)", o: "cliente" }, { t: "bloqueo y etiquetado", o: "publico" }],
    canonica: "bloqueo/etiquetado (LOTO)", dom: "Seguridad", anillo: 2, modal: null,
    cite: "Procedimiento de seguridad · cliente fija sigla LOTO" },
  { id: "g7", src: "bearing",
    variantes: [{ t: "rodamiento", o: "publico" }, { t: "balero", o: "cliente" }, { t: "cojinete", o: "grafo" }],
    canonica: "balero", dom: "Norma mecánica", anillo: 2, modal: null,
    cite: "Lista de partes MAXI · la planta usa 'balero'" },
  { id: "g8", src: "coolant filter",
    variantes: [{ t: "filtro de refrigerante", o: "grafo" }, { t: "filtro de líquido refrigerante", o: "publico" }],
    canonica: "filtro de refrigerante", dom: "Norma mecánica", anillo: 2, modal: null,
    cite: "Manual VF-2 · §6 mantenimiento" },
];
/* origen del término actualmente canónico (para el badge/leyenda). */
function origenCanonico(g, canonica) {
  const c = canonica == null ? g.canonica : canonica;
  const v = g.variantes.find(x => x.t === c);
  return v ? v.o : "cliente";
}

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  6 · MODO CONECTADO DE INGESTA  (ingest_sources.py)                     ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Conectar un repositorio del cliente y traer documentos desde ahí. DOCYAN
   complementa el sistema de registro, no lo reemplaza (sin ERP/CRM/email). */
const FUENTES = [
  { id: "google_drive", label: "Google Drive", icon: "hard-drive", desc: "Carpeta o unidad compartida", estado: "conectado", cuenta: "ops@lab-estandar.mx", docs: 38 },
  { id: "onedrive", label: "OneDrive / SharePoint", icon: "cloud", desc: "Biblioteca de documentos", estado: "disponible" },
  { id: "ftp", label: "FTP / SFTP", icon: "server", desc: "Servidor de archivos por ruta", estado: "disponible" },
  { id: "notion", label: "Notion", icon: "book-open", desc: "Wiki como fuente documental", estado: "disponible" },
];
/* Documentos detectados en una fuente conectada (listos para cotizar). */
const FUENTE_DOCS = [
  { id: "fd1", name: "Manual de mantenimiento — Bomba CIPSA", fmt: "PDF", mb: 2.1, ruta: "/Manuales/2025" },
  { id: "fd2", name: "Certificado calibración — Báscula B-12", fmt: "PDF", mb: 0.4, ruta: "/Metrología" },
  { id: "fd3", name: "SDS — Aditivo acelerante", fmt: "PDF", mb: 0.6, ruta: "/Seguridad/SDS" },
];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  7 · DOCUMENTOS VIVOS  (mis_documentos.py · B13)                        ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Los :DocumentoSource del grafo del tenant. El cliente los lista y los ELIMINA
   (sin residuo → libera cupo del plan). El evento de borrado queda en el FAT
   aunque el contenido consultable se elimine (retención FAT respetada). */
const DOCS_VIVOS = [
  { id: "dv1", name: "Instrucciones de operación — MAXI-10ND", tipo: "manual_operacion", codo: "CODO-OBR-07", lang: "ES", ver: "v2", pages: 12, ts: "12 may 2026" },
  { id: "dv2", name: "Lista de partes — MAXI-10ND", tipo: "ficha_tecnica", codo: "CODO-OBR-07", lang: "ES", ver: "v1", pages: 17, ts: "12 may 2026" },
  { id: "dv3", name: "Ficha técnica — MAXI-10ND", tipo: "ficha_tecnica", codo: "CODO-OBR-07", lang: "ES", ver: "v1", pages: 1, ts: "12 may 2026" },
  { id: "dv4", name: "Manual CNC Haas VF-2", tipo: "manual_mantenimiento", codo: "CODO-MAQ-02", lang: "EN", ver: "v3", pages: 64, ts: "28 may 2026" },
  { id: "dv5", name: "Hettich Rotina 380 — manual", tipo: "manual_operacion", codo: "CODO-LAB-04", lang: "ES", ver: "v1", pages: 32, ts: "19 may 2026" },
  { id: "dv6", name: "Certificado calibración — Mezcladora", tipo: "certificado_calibracion", codo: "CODO-OBR-07", lang: "ES", ver: "v1", pages: 3, ts: "02 jun 2026" },
];
const DOCS_VIVOS_CUPO = { usados: 22, limit: null }; // Profesional ilimitado; freemium = 3

/* Definiciones de planes para la UI interna — alineadas a la FUENTE ÚNICA del
   sitio público (bands.ts v2.1 + precios/page.tsx). Métrica: DOCUMENTOS VIVOS,
   no usuarios. Todas las capacidades en todos los planes (sin add-ons, sin
   "pares lingüísticos" como diferenciador — restricción #1). La diferencia entre
   planes es cuántos documentos viven en el entorno. */
/* Bandas de precio por poder adquisitivo (USD/mes). A = ancla. */
const BANDAS = {
  A: { key: "A", regions: "MX · LatAm", tiers: { esencial: 250, profesional: 550, enterprise: 1200 }, piloto: { list: 250, off: 175 } },
  B: { key: "B", regions: "EE. UU. · Canadá", tiers: { esencial: 349, profesional: 770, enterprise: 1680 }, piloto: { list: 349, off: 244 } },
  C: { key: "C", regions: "UE · UK · Australia", tiers: { esencial: 375, profesional: 825, enterprise: 1800 }, piloto: { list: 375, off: 262 } },
};
const BANDA_DEFAULT = "A";
const fmtUSD = (n) => "$" + n.toLocaleString("en-US");
/* tiers canónicos: documentos vivos + cupo de ingestas [inicial, recurrente/mes]. */
const PLANES = [
  { id: "free", label: "Gratuito", tier: null, blurb: "Para empezar y evaluar, sin tarjeta.",
    docs: "3 documentos vivos · 30 días", cupo: null,
    feats: ["3 documentos vivos por 30 días", "Todas las capacidades del producto", "Usuarios ilimitados por QR", "Consulta con cita al original"] },
  { id: "esencial", label: "Esencial", tier: "esencial", blurb: "Para un equipo o un CoDo.",
    docs: "hasta 50 documentos vivos", cupo: [10, 3],
    feats: ["Hasta 50 documentos vivos", "10 documentos de arranque + 3/mes", "Todas las capacidades del producto", "Usuarios ilimitados", "Consulta multilingüe citada al original"] },
  { id: "pro", label: "Profesional", tier: "profesional", blurb: "Para operación multi-CoDo.", rec: true,
    docs: "hasta 300 documentos vivos", cupo: [30, 10],
    feats: ["Hasta 300 documentos vivos", "30 documentos de arranque + 10/mes", "Todo lo de Esencial", "Inteligencia organizacional (frecuencia y cobertura)", "Soporte prioritario"] },
  { id: "enterprise", label: "Enterprise", tier: "enterprise", from: true, blurb: "Para organizaciones reguladas a escala.",
    docs: "300+ · a la medida", cupo: "negociado",
    feats: ["Documentos vivos 300+ a la medida", "Arranque y cupo mensual negociados", "On-premise / jurisdicción dedicada", "SSO/SAML · residencia de datos", "Acompañamiento de implementación"] },
];
/* adicionales sobre el cupo: fórmula MAX($15, costo×25). Para la UI interna. */
const PLAN_ADICIONAL = "Documentos sobre el cupo: desde $15, cotizados antes de cobrar.";
/* métodos de pago configurados del tenant (Capa B billing). */
const METODOS_PAGO = [
  { id: "mp1", tipo: "card", marca: "Visa", num: "4421", exp: "08/27", titular: "Jorge Medina", principal: true },
  { id: "mp2", tipo: "spei", marca: "SPEI / transferencia", num: null, detalle: "CLABE ···· 8842 · BBVA", principal: false },
];

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║  8 · INTELIGENCIA ORGANIZACIONAL  (mo.py · Playbooks Niveles A/B/C)     ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   Nivel C — Sugerencias: patrones que el grafo detecta. El admin las ACEPTA
   (→ se vuelven Playbook), RECHAZA o IGNORA. DOCYAN no interrumpe: viven aquí,
   a demanda. Naming progresivo: "Playbook" se gana, no se impone.
   Nivel B — Playbooks: secuencias gobernadas (crear / editar / correr / borrar). */
const SUGERENCIAS = [
  { id: "su1", tipo: "secuencia", icon: "repeat", titulo: "Secuencia de arranque repetida en la MAXI-10ND",
    detalle: "3 colaboradores corren las mismas 3 consultas, en orden, antes de arrancar la mezcladora.",
    codo: "CODO-OBR-07", evidencia: "14 días · 3 colaboradores",
    pasos: [{ q: "¿A cuántas RPM debe girar la olla?", key: "rpm" }, { q: "¿A qué rpm calibro el motor?", key: "calib" }, { q: "¿Qué aceite usa el motor?", key: "aceite" }] },
  { id: "su2", tipo: "estacional", icon: "calendar-clock", titulo: "Consultas de calibración suben antes de cada auditoría",
    detalle: "El patrón es estacional en CODO-LAB-04. Podrías preparar un Playbook de pre-auditoría.",
    codo: "CODO-LAB-04", evidencia: "Patrón · 30 días",
    pasos: [{ q: "¿Cuándo vence la calibración?", key: "alertas" }, { q: "Historial de calibración", key: "historial" }] },
  { id: "su3", tipo: "observacion", icon: "file-warning", titulo: "Holgura anotada por 2 personas en el mismo acople",
    detalle: "Dos colaboradores registraron una observación similar sobre el acople motor-eje.",
    codo: "CODO-OBR-07", evidencia: "Observaciones · 30 días",
    pasos: [{ q: "¿Qué dice el manual del síntoma de vibración?", key: "vibra" }] },
];
const PLAYBOOKS = [
  { id: "pb1", nombre: "Arranque seguro — MAXI-10ND", descripcion: "Rutina previa al arranque de la mezcladora.",
    codo: "CODO-OBR-07", origen: "sugerencia", corridas: 42,
    pasos: [{ q: "¿A cuántas RPM debe girar la olla?", key: "rpm" }, { q: "¿A qué rpm calibro el motor?", key: "calib" }] },
  { id: "pb2", nombre: "Cambio de filtro — CNC VF-2", descripcion: "Pasos de mantenimiento del filtro de refrigerante.",
    codo: "CODO-MAQ-02", origen: "manual", corridas: 7,
    pasos: [{ q: "¿Cómo cambio el filtro de refrigerante?", key: "filtro" }] },
];

window.DOCYAN_SCHEMAS = {
  PRICING, USAGE, TIERS, SETUP, LIFECYCLE, COBRO,
  costoBase, precioSetup, tiempoSegPorTokens,
  FASES, SCHEMAS, SCHEMA_BY_ID, ESTADO_META,
  CUPO_DEMO, COTIZACIONES, INGEST_PHASES,
  GLOSARIO, GLOSARIO_PAR, GLOSARIO_ORIGEN, OBLIGATORIEDAD, origenCanonico,
  FUENTES, FUENTE_DOCS,
  DOCS_VIVOS, DOCS_VIVOS_CUPO,
  SUGERENCIAS, PLAYBOOKS,
  PLANES, PLAN_ADICIONAL, METODOS_PAGO, BANDAS, BANDA_DEFAULT, fmtUSD,
};
Object.assign(window, {
  SCHEMAS, SCHEMA_BY_ID, ESTADO_META, FASES,
  TIERS, SETUP, LIFECYCLE_DOCYAN: LIFECYCLE, COBRO_DOCYAN: COBRO,
  CUPO_DEMO, COTIZACIONES, INGEST_PHASES,
  GLOSARIO, GLOSARIO_PAR, GLOSARIO_ORIGEN, OBLIGATORIEDAD, origenCanonico,
  FUENTES, FUENTE_DOCS,
  DOCS_VIVOS, DOCS_VIVOS_CUPO,
  SUGERENCIAS, PLAYBOOKS,
  PLANES, PLAN_ADICIONAL, METODOS_PAGO, BANDAS, BANDA_DEFAULT, fmtUSDDocyan: fmtUSD,
  costoBaseDocyan: costoBase, precioSetupDocyan: precioSetup,
});
