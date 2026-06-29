/* DOCYAN — shared data: CoDos, documentos, respuestas citadas, navegación.
   Datos reales de la revolvedora de concreto CIPSA MAXI-10ND donde aplica. */

/* respuestas canónicas (verbatim real de los manuales MAXI-10ND) */
const ANSWERS = {
  rpm: { q: "RPM de la olla", value: "28–32", unit: "rpm", mode: "cache",
    note: "Calibra el motor hasta que la olla trabaje de 28 a 32 rpm. Si no tienes tacómetro, coloca una marca en la olla y cuéntalas.",
    cite: "Operación MAXI-10ND · Calibración del motor", page: 6, lang: "ES",
    span: "En caso de no contar con tacómetro, colocar una marca en la olla y calibrar el motor hasta que la olla trabaje de 28 a 32 revoluciones por minuto.", mark: "28 a 32 revoluciones por minuto" },
  calib: { q: "Calibración del motor", value: "2300–2400", unit: "rpm", mode: "cache",
    note: "2300–2400 rpm en las versiones estándar; 3000–3100 rpm para motores de 5.5 hp. Aprieta el tornillo tope del acelerador en esa posición.",
    cite: "Operación MAXI-10ND · Calibración del motor", page: 6, lang: "ES",
    span: "gire la palanca del acelerador hasta obtener la velocidad necesaria (3000-3100 rpm para motores de 5.5 hp y 2300-2400 rpm para las demás versiones de motor). Apriete el tornillo tope a la posición que se encuentre la palanca.", mark: "2300-2400 rpm para las demás versiones" },
  aceite: { q: "Aceite del motor", text: "El motor usa aceite SAE-30. En la lista de partes es la refacción con código CIP490482.", mode: "synth",
    cite: "Lista de partes · Ensamble Motor", page: 3, lang: "ES",
    span: "CIP490482   ACEITE SAE-30", mark: "ACEITE SAE-30" },
  refa: { q: "Cómo pedir una refacción", text: "Al solicitar refacciones especifica el modelo (MAXI-10ND), el número de serie de la máquina y el código de la pieza (p. ej. CIP504107).", mode: "synth",
    cite: "Operación MAXI-10ND · Uso de lista de partes", page: 12, lang: "ES",
    span: "deberá especificar: Modelo de la máquina · Número de serie de la misma · Código de la pieza que necesita.", mark: "Modelo de la máquina · Número de serie de la misma · Código de la pieza que necesita" },
  banda: { q: "Banda en V por motor", text: "Depende del motor: B-54 para Kohler 12HP; B-55 para Honda 8/13HP y Kohler 9/14HP; B-57 para Briggs 8HP / Robin 7HP.", mode: "synth",
    cite: "Lista de partes · Ensamble Motor", page: 3, lang: "ES",
    span: "CIP504107 BANDA V SECCION B-54 PARA KOHLER 12HP · CIP493399 BANDA V SECCION B-55 PARA HONDA 8HP, 13HP; KOHLER 9HP, 14HP.", mark: "BANDA V SECCION B-54" },
  vel: { q: "Velocidad máxima del rotor", value: "4,000", unit: "rpm", mode: "cache",
    note: "Rotor de ángulo fijo. No exceder con carga desbalanceada.",
    cite: "Hettich · cap. 2", page: 9, lang: "ES", span: "Velocidad máxima de operación: 4,000 rpm con el rotor de ángulo fijo.", mark: "4,000 rpm" },
  vibra: { kind: "troubleshoot", q: "Vibración al arrancar", text: "Causa probable: desbalance del rotor. Revisa el asiento de los tubos y que las masas estén pareadas.", mode: "synth",
    cite: "Guía de fallas · §3.5", page: 7, lang: "ES", span: "Vibración al arranque — verificar primero el balance del rotor y la holgura del acople motor-eje.", mark: "holgura del acople motor-eje" },
  filtro: { kind: "steps", q: "Cambio del filtro de refrigerante", title: "Cambio del filtro de refrigerante", text: "Detén la máquina y aplica LOTO; cierra la válvula y deja drenar 2 min antes de retirar la tapa.", mode: "synth",
    ppe: [["hand", "Guantes nitrilo"], ["glasses", "Gafas de seguridad"]],
    steps: [
      "Detén la máquina y aplica bloqueo/etiquetado (LOTO) en el interruptor principal.",
      "Cierra la válvula de suministro y deja drenar 2 min al depósito.",
      "Retira la tapa del alojamiento del filtro girando en sentido antihorario.",
      "Extrae el cartucho usado y deséchalo según el MSDS del refrigerante.",
      "Coloca el cartucho nuevo, vuelve a sellar y reabre la válvula.",
    ],
    warn: { lab: "Advertencia", text: "No retires la tapa sin haber drenado: el alojamiento permanece presurizado." },
    cite: "Manual VF-2 · §7.3", page: 28, lang: "EN", span: "Stop the machine and apply lock-out/tag-out; the housing remains pressurized until fully drained.", mark: "the housing remains pressurized" },
  capacidad: { q: "Capacidad y producción", value: "350", unit: "L", mode: "cache",
    note: "Volumen de la olla plástico 350 L. Producción aprox. 5 m³ por hora, con ciclo de trabajo de ~3 min.",
    cite: "Operación MAXI-10ND · Especificaciones", page: 5, lang: "ES",
    span: "Volumen de la olla plástico 350 Lts · Producción por hora 5 metros cúbicos · Ciclo de trabajo 3 minutos aprox.", mark: "350 Lts" },
  diag: { kind: "diagram", q: "Diagrama del rotor", title: "Diagrama · rotor y cabezal", mode: "cache",
    cite: "Hettich Rotina 380 · fig. 4", page: 14, lang: "ES",
    span: "Rotor de ángulo fijo (6 × 50 ml): no exceder el desbalance máximo de carga. La tapa de bayoneta debe alinear la marca con el punto antes de girar.", mark: "no exceder el desbalance máximo de carga" },
  video: { kind: "video", q: "Montaje del rotor", title: "Video · montaje del rotor", mode: "cache",
    cite: "Hettich · capacitación cap. 3", page: 31, lang: "ES",
    span: "Con el rotor fuera, limpia el eje con un paño sin pelusa y verifica que no queden residuos en el asiento cónico antes del montaje.", mark: "verifica que no queden residuos en el asiento cónico" },
  historial: { kind: "history", q: "Historial de la centrífuga", title: "Historial de la centrífuga", mode: "synth" },
  alertas: { kind: "alerts", q: "Alertas pendientes", title: "Alertas pendientes", mode: "synth" },
  compara: { kind: "compare", q: "Comparativa rev. C vs D", title: "Comparativa · Manual VF-2", mode: "synth",
    cite: "VF-2 · §4.2.1 · Δ rev.", page: 12, lang: "ES",
    span: "Rev. D — par de apriete del perno B: 85 N·m (antes 80 N·m), en cruz en 3 pasos. Se elimina la lubricación previa del perno.", mark: "85 N·m (antes 80 N·m)" },
  traduccion: { kind: "bilingual", q: "Equivalente bilingüe del manual VF-2", title: "Memoria de traducción · VF-2 · EN-US → ES-MX", mode: "synth",
    cite: "TM VF-2 · par EN-US/ES-MX", page: 28, lang: "EN",
    span: "Stop the machine and apply lock-out/tag-out; the housing remains pressurized until fully drained.", mark: "lock-out/tag-out" },
};

/* Eje A (tipo documental) por respuesta — el render proviene de un schema.
   Hace trazable cada respuesta a su tipo (answers.jsx muestra la procedencia). */
const ANSWER_TIPO = {
  rpm: "manual_operacion", calib: "manual_operacion", aceite: "ficha_tecnica", refa: "ficha_tecnica",
  banda: "ficha_tecnica", vel: "manual_operacion", vibra: "manual_mantenimiento", filtro: "manual_mantenimiento",
  capacidad: "ficha_tecnica", diag: "manual_operacion", video: "manual_operacion", historial: "registro_historico",
  alertas: "certificado_calibracion", compara: "manual_operacion", traduccion: "memoria_traduccion",
};
Object.entries(ANSWER_TIPO).forEach(([k, v]) => { if (ANSWERS[k]) ANSWERS[k].tipo = v; });

/* documentos por CoDo (para doctabs en consulta) — las consultas sugeridas son POR DOCUMENTO */
const MAXI_DOCS = [
  { key: "op", name: "Instrucciones de operación", lang: "ES", meta: "manual · 12 págs", icon: "book-open", tipo: "manual_operacion",
    sugs: [["gauge", "¿A cuántas RPM debe girar la olla?", "rpm"], ["settings", "¿A qué rpm calibro el motor?", "calib"]] },
  { key: "partes", name: "Lista de partes", lang: "ES", meta: "refacciones · 17 págs", icon: "list-checks", tipo: "ficha_tecnica",
    sugs: [["fuel", "¿Qué aceite usa el motor?", "aceite"], ["disc-3", "¿Qué banda en V lleva mi motor?", "banda"], ["box", "¿Cómo pido una refacción?", "refa"]] },
  { key: "ficha", name: "Ficha técnica", lang: "ES", meta: "ficha técnica · 1 pág", icon: "file-text", tipo: "ficha_tecnica",
    sugs: [["ruler", "¿Capacidad y producción?", "capacidad"]] },
];

/* CoDos del cliente (con acceso del colaborador) */
const CODOS = [
  { key: "maxi10", id: "CODO-OBR-07", name: "Mezcladora de concreto MAXI-10ND", icon: "blend",
    docs: 3, loc: "Obra · cuadrilla 2", colab: 6, consultas: 84, alert: false,
    docList: MAXI_DOCS,
    sugs: [["gauge", "¿A cuántas RPM debe girar la olla?", "rpm"], ["settings", "¿A qué rpm calibro el motor?", "calib"], ["fuel", "¿Qué aceite usa el motor?", "aceite"], ["box", "¿Cómo pido una refacción?", "refa"]] },
  { key: "lab04", id: "CODO-LAB-04", name: "Centrífuga Hettich Rotina 380", icon: "disc-3",
    docs: 12, loc: "Lab · mesa 3", colab: 9, consultas: 318, alert: true,
    docList: [{ key: "het", name: "Hettich Rotina 380 — manual", lang: "ES", meta: "manual · 32 págs", icon: "book-open", tipo: "manual_operacion",
      sugs: [["gauge", "¿Velocidad máxima del rotor?", "vel"], ["activity", "Vibra al arrancar", "vibra"], ["image", "Muéstrame el diagrama del rotor", "diag"], ["play-circle", "Video: montaje del rotor", "video"], ["history", "Historial de esta centrífuga", "historial"], ["bell", "¿Qué alertas tengo pendientes?", "alertas"]] }],
    sugs: [["gauge", "¿Velocidad máxima del rotor?", "vel"], ["activity", "Vibra al arrancar", "vibra"], ["image", "Muéstrame el diagrama del rotor", "diag"], ["play-circle", "Video: montaje del rotor", "video"], ["history", "Historial de esta centrífuga", "historial"], ["bell", "¿Qué alertas tengo pendientes?", "alertas"]] },
  { key: "maq02", id: "CODO-MAQ-02", name: "CNC Haas VF-2", icon: "cog",
    docs: 7, loc: "Maquinado · celda B", colab: 4, consultas: 142, alert: false,
    docList: [{ key: "vf2", name: "Manual CNC Haas VF-2", lang: "EN", meta: "manual · 64 págs", icon: "book-open", tipo: "manual_mantenimiento",
      sugs: [["wrench", "¿Cómo cambio el filtro de refrigerante?", "filtro"], ["git-compare", "Compara la rev. C y D del manual", "compara"], ["languages", "Equivalente bilingüe del manual", "traduccion"]] }],
    sugs: [["wrench", "¿Cómo cambio el filtro de refrigerante?", "filtro"], ["git-compare", "Compara la rev. C y D del manual", "compara"], ["languages", "Equivalente bilingüe del manual", "traduccion"]] },
];

/* acervo para el wizard (los 3 reales + extras vinculables) — `tipo` = schema documental */
const ACERVO = [
  { id: "d1", name: "Instrucciones de operación — MAXI-10ND", lang: "ES", kind: "manual · PDF", tipo: "manual_operacion", pages: 12, mb: 1.2, seg: "operacion" },
  { id: "d2", name: "Lista de partes — MAXI-10ND", lang: "ES", kind: "refacciones · PDF", tipo: "ficha_tecnica", pages: 17, mb: 1.6, seg: "operacion" },
  { id: "d3", name: "Ficha técnica — MAXI-10ND", lang: "ES", kind: "ficha técnica · PDF", tipo: "ficha_tecnica", pages: 1, mb: 0.3, seg: "manuales" },
  { id: "d4", name: "NOM-018-STPS — pictogramas", lang: "ES", kind: "norma · PDF", tipo: "norma_ley_reglamento", pages: 12, mb: 0.7, seg: "seguridad" },
  { id: "d5", name: "Bitácora de mantenimiento 2025", lang: "ES", kind: "registro · XLSX", tipo: "registro_historico", pages: 1, mb: 0.2, seg: "calibracion" },
  { id: "d6", name: "Garantía y datos del motor", lang: "ES", kind: "ficha técnica · PDF", tipo: "ficha_tecnica", pages: 4, mb: 0.4, seg: "operacion" },
];
const SEGMENTS = [
  { key: "manuales", label: "Manuales de equipo", icon: "book-open", crit: "op" },
  { key: "operacion", label: "Operación & mantenimiento", icon: "list-checks", crit: "op" },
  { key: "seguridad", label: "Seguridad & MSDS", icon: "shield-alert", crit: "sec" },
  { key: "calibracion", label: "Calibración & registros", icon: "ruler", crit: "op" },
];
const SEG_LABEL = Object.fromEntries(SEGMENTS.map(s => [s.key, s.label]));
const VERTICALES = ["Construcción — planta de concreto", "Laboratorio ISO 17025", "Maquila IMMEX", "Minería & agregados", "Farmacéutica"];
const PARES = ["ES-MX · EN-US", "ES-MX", "EN-US · ES-MX", "ES-CO · EN-US"];

/* menús: org adaptable al plan + colaborador */
const NAV_ORG = {
  free: [
    ["files", "Documentos", "codos"],
    ["scan-line", "Consultar", "consultar"],
    ["users", "Usuarios", "usuarios"],
    ["gem", "Plan", "plan"],
  ],
  pro: [
    ["grp", "Operación"],
    ["layout-dashboard", "Resumen", "resumen"],
    ["sparkles", "Inteligencia", "inteligencia"],
    ["folder-tree", "CoDos", "codos"],
    ["scan-line", "Consultar", "consultar"],
    ["bell", "Alertas", "alertas"],
    ["grp", "Administración"],
    ["files", "Documentos", "documentos"],
    ["upload", "Ingesta", "ingesta"],
    ["library", "Schemas", "schemas"],
    ["book-marked", "Glosario", "glosario"],
    ["shield-check", "Gobernanza & FAT", "gobernanza"],
    ["qr-code", "Generar QRs", "qrs"],
    ["users", "Usuarios", "usuarios"],
    ["gem", "Plan", "plan"],
  ],
};
const NAV_COLAB = [
  ["house", "Inicio", "inicio"],
  ["scan-line", "Consultar", "consultar"],
  ["bookmark", "Guardadas", "guardadas"],
  ["user", "Perfil", "perfil"],
];

Object.assign(window, { ANSWERS, CODOS, ACERVO, SEGMENTS, SEG_LABEL, VERTICALES, PARES, NAV_ORG, NAV_COLAB, MAXI_DOCS });
