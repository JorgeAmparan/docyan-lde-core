/* DOCYAN sitio público v2 — CoDos de demo sin registro (5 verticales).
   Conjuntos de Documentos curados; cada qa es una respuesta ANCLADA
   con cite/doc/page/span al fragmento exacto que la sostiene. */

const CODOS = [
  {
    key: "lab", label: "Laboratorios", icon: "flask-conical",
    codo: "CODO-LAB-04", entity: "Centrífuga Hettich Rotina 380",
    blurb: "Centrífugas, balanzas, calibraciones vigentes y MSDS de reactivos.",
    ctx: "una centrífuga de laboratorio Hettich Rotina 380 (ISO/IEC 17025)",
    docs: ["Manual de calibración de centrífuga", "MSDS de reactivo común", "Certificado de trazabilidad de patrón"],
    qa: [
      { kind: "info", q: "¿Torque del perno B del rotor?", value: "85", unit: "N·m", note: "Aplicado en cruz en tres etapas progresivas (40 → 65 → 85 N·m).", doc: "Manual de calibración · Rotina 380", cite: "Manual Rotina 380 · §4.2.1", page: 12, span: "El par de apriete del perno B es 85 N·m, aplicado en cruz en tres etapas progresivas (40 → 65 → 85 N·m)." },
      { kind: "steps", q: "¿Cómo cambio el filtro de refrigerante?", title: "Cambio del filtro de refrigerante", ppe: [["hand", "Guantes de nitrilo"], ["glasses", "Gafas de seguridad"]], steps: ["Despresuriza el circuito y espera 2 minutos.", "Retira la tapa con la herramienta indicada.", "Sustituye el cartucho por uno nuevo.", "Purga el aire antes de reconectar."], warn: ["ADVERTENCIA", "No abrir con el sistema presurizado."], doc: "Manual de calibración · Rotina 380", cite: "Manual Rotina 380 · §7.3", page: 28, span: "El cambio del filtro de refrigerante se realiza con el circuito despresurizado; sustituir el cartucho y purgar el aire antes de reconectar." },
      { kind: "diagram", q: "Muéstrame el diagrama del rotor", title: "Rotor y cabezal", pins: [[1, 33, 26, "Tapa del rotor"], [2, 58, 47, "Rotor de ángulo fijo"], [3, 44, 72, "Acople motor-eje"]], doc: "Manual de calibración · Rotina 380", cite: "Plano Rotina 380 · fig. 4", page: 15, span: "Fig. 4 — Despiece del rotor: tapa, rotor de ángulo fijo y acople motor-eje." },
      { kind: "troubleshoot", q: "La centrífuga vibra al arrancar", title: "Diagnóstico · vibración al arrancar", ask: "¿La vibración aparece solo en vacío o también con carga?", options: [["Solo en vacío", "Causa probable: desbalance del rotor. Revisa el asiento de los tubos y verifica que las masas estén pareadas."], ["También con carga", "Causa probable: holgura en el acople motor-eje. Inspecciona el acople y el par de apriete de la base."]], doc: "Manual de calibración · Rotina 380", cite: "Guía de fallas · §3.5", page: 41, span: "Vibración al arrancar: si ocurre solo en vacío, sospechar desbalance del rotor; con carga, holgura en el acople." },
    ],
  },
  {
    key: "maq", label: "Maquiladoras", icon: "factory",
    codo: "CODO-MAQ-12", entity: "Línea CNC Haas VF-4",
    blurb: "Manuales por línea, cambios de herramienta y MSDS de fluidos de corte.",
    ctx: "una línea CNC Haas VF-4 en una maquiladora IMMEX (IATF 16949 / NOM-018-STPS)",
    docs: ["Manual operativo de CNC", "Procedimiento de cambio de herramienta", "Hoja MSDS de fluido de corte"],
    qa: [
      { kind: "info", q: "¿Presión nominal del husillo?", value: "4.5", unit: "bar", note: "Verificar el manómetro antes de iniciar el ciclo.", doc: "Manual operativo de CNC", cite: "Manual CNC VF-4 · §4.1", page: 18, span: "Presión nominal del husillo: 4.5 bar. Verificar el manómetro antes de iniciar el ciclo." },
      { kind: "steps", q: "¿Procedimiento de cambio de herramienta?", title: "Cambio de herramienta", ppe: [["hand", "Guantes anticorte"], ["glasses", "Gafas"]], steps: ["Detén el husillo y confirma energía cero.", "Libera el portaherramientas con el botón de cambio.", "Sustituye la herramienta.", "Referencia el cero pieza antes de reanudar."], warn: ["PRECAUCIÓN", "No introducir la mano con el husillo activo."], doc: "Procedimiento de cambio de herramienta", cite: "Manual CNC VF-4 · §6.2", page: 34, span: "El cambio de herramienta se realiza con el husillo detenido; libera el portaherramientas, sustituye la herramienta y referencia el cero pieza." },
      { kind: "compare", q: "Compara la rev. C y D del manual", title: "Manual CNC VF-4", from: "Rev. C", to: "Rev. D", diff: [["chg", "Presión del husillo: 4.0 → 4.5 bar."], ["add", "Verificación de manómetro antes de cada ciclo."], ["del", "Lubricación manual del portaherramientas."]], summary: "La Rev. D sube la presión nominal y formaliza la verificación del manómetro; elimina la lubricación manual.", doc: "Manual operativo de CNC", cite: "Manual CNC VF-4 · §4.1 · Δ rev.", page: 18, span: "Cambio rev. C→D: presión del husillo de 4.0 a 4.5 bar; se añade verificación de manómetro." },
      { kind: "alerts", q: "¿Qué mantenimiento tengo pendiente?", title: "Recordatorios de mantenimiento", items: [["warn", "Cambio de aceite del husillo", "Vence en 5 días"], ["caution", "Calibración del palpador", "En 24 días"]], doc: "Manual operativo de CNC", cite: "Plan de mantenimiento · §9", page: 52, span: "Mantenimiento programado: cambio de aceite del husillo cada 500 h; calibración del palpador semestral." },
    ],
  },
  {
    key: "pharma", label: "Farma", icon: "pill",
    codo: "CODO-PHARMA-03", entity: "Bioreactor B-3",
    blurb: "SOPs, Batch Records y validaciones de limpieza bajo GMP.",
    ctx: "un bioreactor B-3 en manufactura farmacéutica (GMP · FDA · COFEPRIS)",
    docs: ["SOP de operación de bioreactor", "Plantilla Batch Manufacturing Record", "Validación de limpieza CIP"],
    qa: [
      { kind: "info", q: "¿Temperatura de operación del bioreactor?", value: "37", unit: "°C", note: "Agitación 200 rpm y pH 7.0 ± 0.2; registrar en el BMR cada 30 min.", doc: "SOP de operación de bioreactor", cite: "SOP-BR-03 · §3.4", page: 8, span: "Condiciones nominales del bioreactor: 37 °C, agitación 200 rpm, pH 7.0 ± 0.2; registrar en el BMR cada 30 minutos." },
      { kind: "steps", q: "¿Protocolo de limpieza CIP?", title: "Limpieza CIP del bioreactor", ppe: [["hand", "Guantes nitrilo"], ["glasses", "Gafas"]], steps: ["Enjuague inicial con agua purificada.", "Recircula NaOH 2% a 80 °C por 20 min.", "Enjuague final con agua purificada.", "Registra la conductividad del último enjuague."], warn: ["ADVERTENCIA", "Solución cáustica caliente — EPP obligatorio."], doc: "Validación de limpieza CIP", cite: "VAL-CIP-03 · §2", page: 4, span: "Ciclo CIP: enjuague inicial, recirculación de NaOH 2% a 80 °C, enjuague final; registrar conductividad del último enjuague." },
      { kind: "history", q: "Historial de lotes de este bioreactor", title: "Lotes recientes · B-3", events: [["Hoy", "Lote BR-2291 iniciado · pH en rango"], ["Ayer", "Lote BR-2290 liberado · OK"], ["12 may", "Desviación de pH corregida · CAPA-08"]], pattern: "Las desviaciones de pH aumentan en lotes de fin de turno.", doc: "Plantilla Batch Manufacturing Record", cite: "BMR · histórico", page: 1, span: "Registro de lotes del bioreactor B-3: cada entrada con firma, fecha y estado de liberación." },
      { kind: "video", q: "Video: arranque del bioreactor", title: "Arranque del bioreactor B-3", dur: "06:10", chapters: [["00:00", "EPP y precondiciones"], ["01:40", "Inoculación"], ["03:20", "Ajuste de parámetros"], ["05:05", "Registro en BMR"]], doc: "SOP de operación de bioreactor", cite: "Capacitación SOP-BR-03 · cap. 2", page: 8, span: "Procedimiento de arranque: precondiciones, inoculación, ajuste de parámetros y registro en el BMR." },
    ],
  },
  {
    key: "min", label: "Minería", icon: "mountain",
    codo: "CODO-MIN-08", entity: "Excavadora Komatsu PC-2000",
    blurb: "Operación segura, inspección pre-uso y MSDS de combustibles.",
    ctx: "una excavadora Komatsu PC-2000 en piso de mina (safety & compliance, AS/NZS)",
    docs: ["Procedimiento de operación segura de excavadora", "MSDS de combustible diésel", "Reporte de inspección pre-uso"],
    qa: [
      { kind: "info", q: "¿Capacidad del tanque de combustible?", value: "1,800", unit: "L", note: "No operar por debajo del 10% de nivel.", doc: "Procedimiento de operación segura", cite: "POS Komatsu PC-2000 · §4.2", page: 11, span: "Capacidad del tanque de combustible: 1,800 L. No operar por debajo del 10% de nivel." },
      { kind: "steps", q: "¿Pasos de bloqueo y etiquetado (LOTO)?", title: "Bloqueo y etiquetado", ppe: [["hand", "Guantes"], ["hard-hat", "Casco"]], steps: ["Apaga el equipo y retira la llave.", "Aísla la energía y la presión hidráulica.", "Coloca bloqueo y etiqueta personal.", "Verifica energía cero antes de intervenir."], warn: ["PELIGRO", "No intervenir sin verificar energía cero."], doc: "Procedimiento de operación segura", cite: "POS Komatsu PC-2000 · §6", page: 17, span: "Secuencia LOTO: apagar, aislar la energía, colocar bloqueo y etiqueta, verificar energía cero antes de intervenir." },
      { kind: "troubleshoot", q: "La excavadora no arranca", title: "Diagnóstico · no arranca", ask: "¿El tablero enciende al dar contacto?", options: [["Sí enciende", "Causa probable: combustible bajo o filtro obstruido. Verifica nivel y purga el sistema de combustible."], ["No enciende", "Causa probable: batería o corte de seguridad activo. Revisa bornes y el paro de emergencia."]], doc: "Procedimiento de operación segura", cite: "Guía de fallas · §5.2", page: 24, span: "Si no arranca: con tablero encendido, sospechar combustible o filtro; sin tablero, batería o paro de emergencia." },
      { kind: "alerts", q: "¿Tengo inspecciones vencidas?", title: "Inspecciones y certificaciones", items: [["warn", "Inspección pre-uso del turno", "Pendiente hoy"], ["caution", "Certificación del operador", "Vence en 18 días"]], doc: "Reporte de inspección pre-uso", cite: "Bitácora de inspección · §1", page: 1, span: "La inspección pre-uso es obligatoria al inicio de cada turno y se registra en la bitácora." },
    ],
  },
  {
    key: "agri", label: "Agroindustria", icon: "sprout",
    codo: "CODO-AGRI-02", entity: "Tanque enfriamiento leche T-7",
    blurb: "Especificaciones de producto, muestreo y certificados por mercado.",
    ctx: "un tanque de enfriamiento de leche cruda T-7 para agroexportación (trazabilidad multi-mercado)",
    docs: ["Especificación de producto leche cruda", "Protocolo de muestreo", "Certificado de calidad para mercado destino"],
    qa: [
      { kind: "info", q: "¿Temperatura de almacenamiento de la leche cruda?", value: "≤ 4", unit: "°C", note: "Dentro de las 2 h posteriores al ordeño, hasta su recolección.", doc: "Especificación de producto · leche cruda", cite: "Especificación T-7 · §1.3", page: 3, span: "La leche cruda debe enfriarse a ≤ 4 °C dentro de las 2 horas posteriores al ordeño y mantenerse así hasta su recolección." },
      { kind: "steps", q: "¿Protocolo de muestreo?", title: "Toma de muestra representativa", ppe: [["hand", "Guantes"], ["glasses", "Cofia"]], steps: ["Homogeneiza el tanque antes de muestrear.", "Toma muestra en frasco estéril identificado.", "Mantén cadena de frío (≤ 4 °C).", "Envía al laboratorio dentro de 24 h."], warn: ["NOTA", "Frasco estéril y cadena de frío son obligatorios."], doc: "Protocolo de muestreo", cite: "PM-Agri · §2.2", page: 2, span: "Tomar muestra representativa por tanque en frasco estéril, manteniendo la cadena de frío hasta el laboratorio." },
      { kind: "compare", q: "Compara requisitos UE vs EE. UU.", title: "Criterios por mercado", from: "EE. UU.", to: "Unión Europea", diff: [["chg", "Recuento bacteriano: ≤ 300,000 → ≤ 100,000 UFC/ml."], ["chg", "Células somáticas: ≤ 750,000 → ≤ 400,000 /ml."], ["add", "Certificado sanitario por lote exportado."]], summary: "La UE exige límites más estrictos de recuento bacteriano y células somáticas, más certificado sanitario por lote.", doc: "Certificado de calidad para mercado destino", cite: "Cert. · criterios por mercado", page: 1, span: "Mercado UE: recuento bacteriano ≤ 100,000 UFC/ml; células somáticas ≤ 400,000/ml; certificado sanitario por lote." },
      { kind: "history", q: "Historial de recolecciones del tanque", title: "Recolecciones · T-7", events: [["Hoy", "Recolección 06:10 · 2,400 L · 3.8 °C"], ["Ayer", "Recolección 06:05 · 2,310 L · 3.9 °C"], ["Anteayer", "CIP registrado tras recolección"]], pattern: "La temperatura sube levemente los días de mayor volumen.", doc: "Especificación de producto · leche cruda", cite: "Bitácora T-7 · §4.1", page: 6, span: "Cada recolección se registra con volumen y temperatura; la limpieza CIP queda asentada en la bitácora." },
    ],
  },
];

Object.assign(window, { CODOS });
