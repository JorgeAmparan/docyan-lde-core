/* DOCYAN — Consola del fundador (platform_admin). Datos demo.
   PRINCIPIO: metadata sí, contenido nunca. Aquí NO hay texto de documentos
   ni de consultas de cliente — solo cifras, pesos, tiempos, estados, frecuencias. */

/* ── Ciclo de vida de una organización (estado canónico) ─────────────────── */
const LIFECYCLE = {
  activa:     { label: "Activa",     tone: "ok",      icon: "circle-check" },
  gracia:     { label: "Gracia",     tone: "warn",    icon: "clock-alert" },
  suspendida: { label: "Suspendida", tone: "danger",  icon: "ban" },
  cancelada:  { label: "Cancelada",  tone: "muted",   icon: "circle-slash-2" },
  piloto:     { label: "Piloto",     tone: "info",    icon: "flask-conical" },
  freemium:   { label: "Freemium",   tone: "caution", icon: "gift" },
};

const PLANS = {
  Esencial:     { tone: "muted" },
  Profesional:  { tone: "info" },
  Enterprise:   { tone: "ink" },
};

/* Banda de mercado (regional pricing) */
const BANDS = ["MX", "LatAm", "USA/CA", "UE", "UK", "AU"];

/* ── KPIs de plataforma (periodo actual) ─────────────────────────────────── */
const PLATFORM_KPIS = {
  periodo: "Junio 2026",
  orgs:        { value: 38, delta: "+4", sub: "este periodo" },
  usuarios:    { value: 1247, delta: "+86", sub: "61 admins · 1,186 colaboradores" },
  almacenamiento: { value: "2.41", unit: "TB", delta: "+0.18", sub: "metadata de peso · sin contenido" },
  jobsActivos: { value: 5, sub: "2 procesando · 3 en cola" },
  ingresos:    { value: "48,200", unit: "USD", delta: "+12%", sub: "registrados este periodo" },
};

/* ── Banda crítica — lo que exige acción, arriba del todo ─────────────────── */
/* kind: danger | warn | caution | info ; cta marca acción comercial/operativa */
const CRITICAL = [
  { kind: "danger",  icon: "ban",          n: 1, label: "organización suspendida",            detail: "Pharma Vallarta · falta de pago 18 días",            cta: "Revisar cuenta",   to: "orgs" },
  { kind: "danger",  icon: "x-octagon",    n: 1, label: "job de ingesta fallido",             detail: "Pharma Vallarta · Certificados · fase conversión",   cta: "Ver job",          to: "jobs" },
  { kind: "warn",    icon: "clock-alert",  n: 2, label: "organizaciones en gracia",           detail: "Farmacéutica Quálitas (5d) · Ensambles Frontera (2d)", cta: "Gestionar cobro",  to: "ingresos" },
  { kind: "info",    icon: "flask-conical",n: 2, label: "pilotos próximos a vencer",          detail: "Lab Acreditado Saltillo (4d) · Centro Analítico Tijuana (12d)", cta: "Convertir piloto", to: "orgs" },
  { kind: "caution", icon: "gift",         n: 2, label: "freemiums próximos a expirar",        detail: "Bioagro del Valle (3d) · AgroBajío Semillas (8d)",   cta: "Ofertar upgrade",  to: "orgs" },
];

/* ── Tendencias (6 meses) — gráficas hechas a mano con tokens ─────────────── */
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
const TRENDS = {
  orgs:      [24, 27, 29, 33, 35, 38],            // crecimiento acumulado de orgs
  ingresos:  [29.4, 33.1, 36.8, 41.2, 43.0, 48.2],// miles USD / mes
  consultas: [38, 44, 51, 58, 63, 71],            // miles de consultas / mes (frecuencia, nunca causa)
};

/* ── Organizaciones ──────────────────────────────────────────────────────── */
/* dias: solo aplica a piloto/freemium/gracia (días restantes).
   Modelo actual (no prepago): cupoMes = ingestas incluidas/mes del plan ·
   cupoUsado = consumidas este mes · excedenteUSD = adicionales cobrados este ciclo
   (fórmula MAX($15,…)). Freemium no tiene cupo (límite de 3 docs vivos). */
const ORGS = [
  { id: "ORG-0042", name: "Maquiladora Delta Norte", alta: "12 ene 2025", plan: "Enterprise", banda: "MX", estado: "activa", usuarios: 64, docs: 1240,
    storageGB: 96.4, avgIngestMin: 12.1, cupoMes: 40, cupoUsado: 31, excedenteUSD: 0, consultas30d: 9840, proximoCorte: "01 jul 2026", vertical: "IMMEX · maquila" },
  { id: "ORG-0007", name: "Laboratorio Estándar de México", alta: "03 mar 2024", plan: "Profesional", banda: "MX", estado: "activa", usuarios: 18, docs: 312,
    storageGB: 18.2, avgIngestMin: 9.4, cupoMes: 10, cupoUsado: 7, excedenteUSD: 60, consultas30d: 4820, proximoCorte: "01 jul 2026", vertical: "Lab ISO 17025" },
  { id: "ORG-0019", name: "Minera Cerro Verde", alta: "21 ago 2024", plan: "Enterprise", banda: "LatAm", estado: "activa", usuarios: 52, docs: 980,
    storageGB: 74.0, avgIngestMin: 14.8, cupoMes: 40, cupoUsado: 22, excedenteUSD: 0, consultas30d: 7210, proximoCorte: "15 jul 2026", vertical: "Minería" },
  { id: "ORG-0031", name: "Farmacéutica Quálitas", alta: "09 oct 2024", plan: "Profesional", banda: "MX", estado: "gracia", dias: 5, usuarios: 24, docs: 540,
    storageGB: 31.6, avgIngestMin: 10.7, cupoMes: 10, cupoUsado: 10, excedenteUSD: 120, consultas30d: 3140, proximoCorte: "vencido", vertical: "Farma" },
  { id: "ORG-0050", name: "Ensambles Frontera", alta: "18 feb 2025", plan: "Profesional", banda: "USA/CA", estado: "gracia", dias: 2, usuarios: 21, docs: 410,
    storageGB: 24.1, avgIngestMin: 8.9, cupoMes: 10, cupoUsado: 9, excedenteUSD: 0, consultas30d: 2680, proximoCorte: "vencido", vertical: "Manufactura" },
  { id: "ORG-0044", name: "Centro Analítico Tijuana", alta: "02 may 2026", plan: "Profesional", banda: "USA/CA", estado: "piloto", dias: 12, usuarios: 9, docs: 86,
    storageGB: 4.8, avgIngestMin: 9.1, cupoMes: 10, cupoUsado: 3, excedenteUSD: 0, consultas30d: 318, proximoCorte: "—", vertical: "Lab acreditado" },
  { id: "ORG-0061", name: "Lab Acreditado Saltillo", alta: "20 may 2026", plan: "Esencial", banda: "MX", estado: "piloto", dias: 4, usuarios: 6, docs: 42,
    storageGB: 2.1, avgIngestMin: 7.6, cupoMes: 3, cupoUsado: 2, excedenteUSD: 0, consultas30d: 142, proximoCorte: "—", vertical: "Lab ISO 17025" },
  { id: "ORG-0058", name: "Laboratorio Sur", alta: "28 abr 2026", plan: "Esencial", banda: "MX", estado: "piloto", dias: 20, usuarios: 5, docs: 31,
    storageGB: 1.7, avgIngestMin: 7.2, cupoMes: 3, cupoUsado: 1, excedenteUSD: 0, consultas30d: 96, proximoCorte: "—", vertical: "Lab" },
  { id: "ORG-0055", name: "Bioagro del Valle", alta: "10 abr 2026", plan: "Esencial", banda: "LatAm", estado: "freemium", dias: 3, usuarios: 4, docs: 18,
    storageGB: 0.9, avgIngestMin: 6.8, cupoMes: 0, cupoUsado: 0, excedenteUSD: 0, consultas30d: 64, proximoCorte: "—", vertical: "Agro" },
  { id: "ORG-0048", name: "AgroBajío Semillas", alta: "25 mar 2026", plan: "Esencial", banda: "MX", estado: "freemium", dias: 8, usuarios: 7, docs: 26,
    storageGB: 1.3, avgIngestMin: 7.0, cupoMes: 0, cupoUsado: 0, excedenteUSD: 0, consultas30d: 88, proximoCorte: "—", vertical: "Agro" },
  { id: "ORG-0026", name: "IMMEX Componentes Sigma", alta: "14 jul 2024", plan: "Profesional", banda: "MX", estado: "activa", usuarios: 33, docs: 612,
    storageGB: 40.2, avgIngestMin: 11.2, cupoMes: 10, cupoUsado: 6, excedenteUSD: 0, consultas30d: 5120, proximoCorte: "08 jul 2026", vertical: "IMMEX" },
  { id: "ORG-0013", name: "Minería del Pacífico", alta: "30 jun 2024", plan: "Enterprise", banda: "LatAm", estado: "activa", usuarios: 47, docs: 870,
    storageGB: 68.5, avgIngestMin: 13.9, cupoMes: 40, cupoUsado: 28, excedenteUSD: 0, consultas30d: 6430, proximoCorte: "20 jul 2026", vertical: "Minería" },
  { id: "ORG-0036", name: "Pharma Vallarta", alta: "05 sep 2024", plan: "Esencial", banda: "MX", estado: "suspendida", usuarios: 11, docs: 154,
    storageGB: 8.6, avgIngestMin: 9.8, cupoMes: 3, cupoUsado: 0, excedenteUSD: 0, consultas30d: 0, proximoCorte: "vencido", vertical: "Farma" },
  { id: "ORG-0021", name: "Química Industrial Bajío", alta: "11 ago 2024", plan: "Profesional", banda: "MX", estado: "cancelada", usuarios: 0, docs: 0,
    storageGB: 0, avgIngestMin: 0, cupoMes: 0, cupoUsado: 0, excedenteUSD: 0, consultas30d: 0, proximoCorte: "—", vertical: "Química" },
];

/* ── Códigos de acceso (pilotos) ─────────────────────────────────────────── */
/* estado: activo | usado | expirado | revocado */
const ACCESS_CODES = [
  { code: "PILOTO-7K2M-XR4P", estado: "activo",   cuotaDocs: 50, vence: "30 jun 2026", generado: "01 jun 2026", org: null,                       canjeado: null },
  { code: "PILOTO-9M1T-BR8L", estado: "activo",   cuotaDocs: 50, vence: "15 jul 2026", generado: "28 may 2026", org: null,                       canjeado: null },
  { code: "PILOTO-3F9Q-LD2N", estado: "usado",    cuotaDocs: 50, vence: "20 jun 2026", generado: "02 may 2026", org: "Centro Analítico Tijuana", canjeado: "02 may 2026" },
  { code: "PILOTO-5J7R-QW3C", estado: "usado",    cuotaDocs: 50, vence: "10 jun 2026", generado: "20 abr 2026", org: "Lab Acreditado Saltillo",  canjeado: "20 may 2026" },
  { code: "PILOTO-8H4N-ZP6K", estado: "expirado", cuotaDocs: 25, vence: "31 may 2026", generado: "01 may 2026", org: null,                       canjeado: null },
  { code: "PILOTO-2C6V-WK9D", estado: "revocado", cuotaDocs: 50, vence: "30 jun 2026", generado: "10 may 2026", org: null,                       canjeado: null },
  { code: "PILOTO-4G8B-TY1M", estado: "expirado", cuotaDocs: 50, vence: "25 may 2026", generado: "15 abr 2026", org: null,                       canjeado: null },
];

/* ── Ingresos (pagos manuales registrados) ───────────────────────────────── */
const PAYMENTS = [
  { fecha: "03 jun 2026", org: "Maquiladora Delta Norte", monto: 2500, cur: "USD", concepto: "Suscripción Enterprise · junio", metodo: "Transferencia" },
  { fecha: "02 jun 2026", org: "Minera Cerro Verde",      monto: 2500, cur: "USD", concepto: "Suscripción Enterprise · junio", metodo: "Transferencia" },
  { fecha: "01 jun 2026", org: "Laboratorio Estándar de México", monto: 11990, cur: "MXN", concepto: "Profesional anual · cuota 6/12", metodo: "Transferencia" },
  { fecha: "01 jun 2026", org: "Minería del Pacífico",    monto: 2500, cur: "USD", concepto: "Suscripción Enterprise · junio", metodo: "Tarjeta" },
  { fecha: "28 may 2026", org: "IMMEX Componentes Sigma", monto: 699,  cur: "USD", concepto: "Suscripción Profesional · junio", metodo: "Transferencia" },
  { fecha: "20 may 2026", org: "Ensambles Frontera",      monto: 699,  cur: "USD", concepto: "Suscripción Profesional · mayo",  metodo: "Tarjeta" },
];

/* Estado de cuenta por org (para el detalle de ingresos) */
const ACCOUNT_STATE = {
  "Maquiladora Delta Norte": { suscripcion: "Enterprise · al corriente", proximoCorte: "01 jul 2026", saldoVencido: 0 },
  "Farmacéutica Quálitas":   { suscripcion: "Profesional · en gracia",   proximoCorte: "vencido · 09 jun", saldoVencido: 699 },
  "Pharma Vallarta":         { suscripcion: "Esencial · suspendida",     proximoCorte: "vencido · 22 may", saldoVencido: 598 },
};

/* ── Soporte (hilos cross-org) ───────────────────────────────────────────── */
/* contenido = comunicación de soporte (permitido); nunca texto de documentos/consultas */
const SUPPORT = [
  { id: "S-318", org: "Maquiladora Delta Norte", user: "R. Cantú · Admin", pantalla: "Admin › Ingesta", asunto: "Cobro de ingesta excedente no aparece en la factura", estado: "abierto", prioridad: "alta", ultima: "hace 14 min",
    hilo: [
      { from: "user", t: "Confirmé 4 ingestas adicionales la semana pasada y no veo el cargo reflejado en la facturación. ¿Lo pueden revisar?", at: "Hoy · 09:42" },
    ] },
  { id: "S-317", org: "Farmacéutica Quálitas", user: "J. Medina · Admin", pantalla: "Admin › Gobernanza & FAT", asunto: "Umbral GRG no guarda cambios", estado: "abierto", prioridad: "media", ultima: "hace 1 h",
    hilo: [
      { from: "user", t: "Cambio el umbral de Seguridad a 0.97 y al recargar vuelve a 0.95. No persiste.", at: "Hoy · 08:55" },
    ] },
  { id: "S-315", org: "Centro Analítico Tijuana", user: "A. Ríos · Colaborador", pantalla: "PWA › Consulta", asunto: "El QR abre el CoDo equivocado", estado: "respondido", prioridad: "alta", ultima: "ayer",
    hilo: [
      { from: "user", t: "El QR de la balanza AB204 me lleva al CoDo de centrífugas. ¿Lo revisan?", at: "Ayer · 16:10" },
      { from: "soporte", t: "Detectado: el QR se generó apuntando a la entidad incorrecta. Lo regeneramos y queda corregido. Reimprime desde Admin › Generar QRs.", at: "Ayer · 17:02" },
    ] },
  { id: "S-312", org: "IMMEX Componentes Sigma", user: "L. Peña · Admin", pantalla: "Commercial › Cuenta", asunto: "Factura de mayo con RFC incorrecto", estado: "respondido", prioridad: "baja", ultima: "hace 3 d",
    hilo: [
      { from: "user", t: "La factura de mayo salió con un RFC viejo. ¿Pueden reemitir?", at: "03 jun · 11:20" },
      { from: "soporte", t: "Reemitida con el RFC actualizado. Te llegó al correo de facturación.", at: "03 jun · 14:40" },
    ] },
  { id: "S-309", org: "Minera Cerro Verde", user: "D. Kim · Admin", pantalla: "Admin › Usuarios", asunto: "Invitación de admin no llega", estado: "cerrado", prioridad: "media", ultima: "hace 5 d",
    hilo: [
      { from: "user", t: "Invité a un admin y el correo no llega. Revisé spam.", at: "01 jun · 09:00" },
      { from: "soporte", t: "El dominio bloqueaba el remitente. Lo agregamos a la lista segura y reenviamos. Confirmado recibido.", at: "01 jun · 10:30" },
    ] },
];

/* ── Jobs de ingesta cross-org (metadata operativa, en vivo) ──────────────── */
/* estado: procesando | encolado | completado | error ; fase: descarga|conversion|extraccion|grafo|dedup */
const JOBS = [
  { id: "JOB-7741", org: "Maquiladora Delta Norte", lote: "Lote MSDS (×6)",         estado: "procesando", fase: "extraccion",  pct: 62, docs: 6, transcurrido: "4:12", eta: "2:40" },
  { id: "JOB-7740", org: "Minera Cerro Verde",      lote: "Histórico perforación",  estado: "procesando", fase: "grafo",       pct: 84, docs: 3, transcurrido: "6:31", eta: "1:05" },
  { id: "JOB-7742", org: "Laboratorio Estándar de México", lote: "Manual CNC Haas VF-2", estado: "encolado", fase: null,        pct: 0,  docs: 1, transcurrido: "—",   eta: "en cola · 1" },
  { id: "JOB-7743", org: "IMMEX Componentes Sigma", lote: "Certificados calidad (×4)", estado: "encolado", fase: null,        pct: 0,  docs: 4, transcurrido: "—",   eta: "en cola · 2" },
  { id: "JOB-7739", org: "Minería del Pacífico",    lote: "Planos eléctricos (×2)", estado: "encolado",   fase: null,          pct: 0,  docs: 2, transcurrido: "—",   eta: "en cola · 3" },
  { id: "JOB-7738", org: "Pharma Vallarta",         lote: "Certificados",           estado: "error",      fase: "conversion",  pct: 18, docs: 2, transcurrido: "0:48", eta: "—", error: "PDF protegido · OCR rechazado" },
  { id: "JOB-7737", org: "Centro Analítico Tijuana", lote: "Manuales de equipo (×3)", estado: "completado", fase: "dedup",     pct: 100,docs: 3, transcurrido: "21:04", eta: "—" },
  { id: "JOB-7736", org: "Laboratorio Sur",         lote: "MSDS reactivos (×2)",    estado: "completado", fase: "dedup",       pct: 100,docs: 2, transcurrido: "13:22", eta: "—" },
];

const PHASE_LABELS = {
  descarga: "Descarga", conversion: "Conversión", extraccion: "Extracción", grafo: "Escritura a grafo", dedup: "Deduplicación",
};

Object.assign(window, {
  LIFECYCLE, PLANS, BANDS, PLATFORM_KPIS, CRITICAL, MONTHS, TRENDS,
  ORGS, ACCESS_CODES, PAYMENTS, ACCOUNT_STATE, SUPPORT, JOBS, PHASE_LABELS,
});
