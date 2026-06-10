/* DOCYAN sitio público v2 — datos de VERTICALES.
   Compartido entre el hub (page.tsx) y el detalle por slug ([slug]/page.tsx).
   Port fiel de verticales.jsx: VERTS (grid de 7) + VDETAIL (3 verticales construidos). */

export interface Bi {
  es: string;
  en: string;
}

export interface Vert {
  key: string;
  ic: string;
  built: boolean;
  norm: string;
  name: Bi;
  desc: Bi;
}

export interface VertFlow {
  ic: string;
  h: Bi;
  p: Bi;
}

export interface VertDetail {
  eyebrow: Bi;
  h1: Bi;
  pain: Bi;
  meta: (string | Bi)[];
  tag: Bi;
  flow: VertFlow[];
  note: Bi;
}

/** Mapa de slug de ruta → key interna del vertical. */
export const SLUG_TO_KEY: Record<string, string> = {
  laboratorios: "lab",
  maquila: "maq",
  flotillas: "flot",
};

/** Mapa de key interna → slug de ruta (para enlaces internos). */
export const KEY_TO_SLUG: Record<string, string> = {
  lab: "laboratorios",
  maq: "maquila",
  flot: "flotillas",
};

export const VERTS: Vert[] = [
  {
    key: "lab",
    ic: "flask-conical",
    built: true,
    norm: "ISO 17025",
    name: { es: "Laboratorios de pruebas", en: "Testing laboratories" },
    desc: {
      es: "Métodos, calibraciones y certificados consultables al instante — antes de que venzan.",
      en: "Methods, calibrations and certificates consultable instantly — before they expire.",
    },
  },
  {
    key: "maq",
    ic: "factory",
    built: true,
    norm: "IATF · ISO 9001",
    name: { es: "Maquila y manufactura", en: "Maquila & manufacturing" },
    desc: {
      es: "Parámetros de máquina y procedimientos en el piso, sin detener la línea para buscar.",
      en: "Machine parameters and procedures on the floor, without stopping the line to search.",
    },
  },
  {
    key: "flot",
    ic: "truck",
    built: true,
    norm: "ASME B31.8 · NOM",
    name: { es: "Flotillas de técnicos", en: "Field technician fleets" },
    desc: {
      es: "El procedimiento completo en el celular del técnico, a 200 km de la oficina.",
      en: "The full procedure on the tech's phone, 200 km from the office.",
    },
  },
  {
    key: "marina",
    ic: "anchor",
    built: false,
    norm: "API · OSHA",
    name: { es: "Plataforma marina y petrolera", en: "Offshore & oil platforms" },
    desc: {
      es: "Donde no hay segunda oportunidad: el dato crítico citado, sin depender de la conexión.",
      en: "Where there is no second chance: the critical datum cited, without depending on connectivity.",
    },
  },
  {
    key: "mina",
    ic: "mountain",
    built: false,
    norm: "NOM-023",
    name: { es: "Minería", en: "Mining" },
    desc: {
      es: "La cuadrilla deja de esperar a «quien sabe»: pregunta y sigue trabajando.",
      en: "The crew stops waiting for “the one who knows”: ask and keep working.",
    },
  },
  {
    key: "vial",
    ic: "traffic-cone",
    built: false,
    norm: "SCT · AASHTO",
    name: { es: "Construcción vial", en: "Road construction" },
    desc: {
      es: "Especificaciones y bitácoras del frente de obra, consultables desde el frente de obra.",
      en: "Specs and logs from the work front, consultable at the work front.",
    },
  },
  {
    key: "agro",
    ic: "wheat",
    built: false,
    norm: "SENASICA · FDA",
    name: { es: "Agroindustria", en: "Agroindustry" },
    desc: {
      es: "Fichas y protocolos del piso de producción a media cosecha, sin volver a la oficina.",
      en: "Datasheets and protocols on the production floor mid-harvest, without going back to the office.",
    },
  },
];

export const VDETAIL: Record<string, VertDetail> = {
  lab: {
    eyebrow: { es: "Laboratorios de pruebas · ISO 17025", en: "Testing laboratories · ISO 17025" },
    h1: {
      es: "«La calibración venció y nadie lo vio a tiempo.»",
      en: "“The calibration expired and nobody caught it in time.”",
    },
    pain: {
      es: "El hallazgo era evitable: la fecha estaba en el certificado, el certificado estaba en una carpeta, y la carpeta estaba a tres clics que nadie dio. En un laboratorio acreditado, ese descuido se llama no conformidad.",
      en: "The finding was avoidable: the date was on the certificate, the certificate was in a folder, and the folder was three clicks nobody made. In an accredited lab, that oversight is called a nonconformity.",
    },
    meta: ["ISO/IEC 17025", "EMA · ILAC", { es: "Auditorías de acreditación", en: "Accreditation audits" }],
    tag: { es: "foto: mesa de laboratorio / equipo de medición", en: "photo: lab bench / measuring equipment" },
    flow: [
      {
        ic: "file-up",
        h: { es: "Métodos y certificados, vivos", en: "Methods and certificates, alive" },
        p: {
          es: "Métodos de prueba, certificados de calibración, manuales de equipo: entran una vez y quedan consultables, con su hash.",
          en: "Test methods, calibration certificates, equipment manuals: ingested once, consultable forever, with their hash.",
        },
      },
      {
        ic: "bell",
        h: { es: "La vigencia te encuentra a ti", en: "Validity finds you" },
        p: {
          es: "Alertas administrativas de vencimiento de calibraciones y revisiones de método — antes de la auditoría, no durante.",
          en: "Administrative alerts for calibration expiry and method reviews — before the audit, not during.",
        },
      },
      {
        ic: "quote",
        h: { es: "El auditor pregunta; tú citas", en: "The auditor asks; you cite" },
        p: {
          es: "«¿Con qué método se corrió esta muestra?» — respuesta con cita al span del método vigente, en segundos.",
          en: "“Which method ran this sample?” — answer with a citation to the current method's span, in seconds.",
        },
      },
    ],
    note: {
      es: "DOCYAN es capa de conocimiento, no tu sistema de registro primario: tus resultados viven en tu LIMS; aquí vive el saber que los rodea.",
      en: "DOCYAN is a knowledge layer, not your primary system of record: your results live in your LIMS; the knowledge around them lives here.",
    },
  },
  maq: {
    eyebrow: { es: "Maquila y manufactura", en: "Maquila & manufacturing" },
    h1: {
      es: "«La línea parada, y el parámetro en cuál de los tres manuales.»",
      en: "“Line down, and the parameter in which of the three manuals.”",
    },
    pain: {
      es: "Termoformado, ensamble, inyección: el dato del proceso existe — en el manual del fabricante, en la hoja de proceso, en el instructivo que alguien actualizó. Mientras lo encuentras, la línea factura tiempo muerto.",
      en: "Thermoforming, assembly, injection: the process datum exists — in the OEM manual, the process sheet, the work instruction someone updated. While you find it, the line bills downtime.",
    },
    meta: ["IATF 16949", "ISO 9001", { es: "Auditorías de cliente", en: "Customer audits" }],
    tag: { es: "foto: piso de termoformado / línea de ensamble", en: "photo: thermoforming floor / assembly line" },
    flow: [
      {
        ic: "file-up",
        h: { es: "Manuales OEM y hojas de proceso", en: "OEM manuals and process sheets" },
        p: {
          es: "El manual de 120 páginas que vino con la máquina — en el idioma en que vino — se vuelve consultable desde el piso.",
          en: "The 120-page manual that came with the machine — in whatever language it came — becomes consultable from the floor.",
        },
      },
      {
        ic: "message-circle-question",
        h: { es: "El operador pregunta en su idioma", en: "The operator asks in their language" },
        p: {
          es: "«¿Temperatura de molde para PP de 2 mm?» — respuesta de un vistazo, con la cita al manual original a un toque.",
          en: "“Mold temperature for 2 mm PP?” — at-a-glance answer, citation to the original manual one tap away.",
        },
      },
      {
        ic: "activity",
        h: { es: "El patrón queda para la planta", en: "The pattern stays with the plant" },
        p: {
          es: "Qué máquina genera más consultas, qué turno pregunta qué: frecuencia visible, sin juicios. DOCYAN cuenta, no concluye.",
          en: "Which machine drives the most queries, which shift asks what: frequency made visible, no judgments. DOCYAN counts, it doesn't conclude.",
        },
      },
    ],
    note: {
      es: "Las respuestas son capa de conocimiento para decidir mejor; los registros de producción siguen en tus sistemas de registro.",
      en: "Answers are a knowledge layer for better decisions; production records stay in your systems of record.",
    },
  },
  flot: {
    eyebrow: {
      es: "Flotillas de técnicos · gasoductos / telecom",
      en: "Field technician fleets · pipelines / telecom",
    },
    h1: {
      es: "«El técnico a 200 km, y el procedimiento en el servidor de la oficina.»",
      en: "“The tech 200 km out, and the procedure on the office server.”",
    },
    pain: {
      es: "Una barra de señal, un cliente esperando y un procedimiento que vive en la intranet. La visita que se repite por falta de un dato es la más cara de todas.",
      en: "One bar of signal, a waiting client and a procedure that lives on the intranet. The site visit repeated for lack of one datum is the most expensive of all.",
    },
    meta: ["ASME B31.8", "NOM-007-ASEA", { es: "Bitácoras de campo", en: "Field logs" }],
    tag: { es: "foto: técnico en derecho de vía / torre", en: "photo: technician at right-of-way / tower" },
    flow: [
      {
        ic: "smartphone",
        h: { es: "El procedimiento, en el celular", en: "The procedure, on the phone" },
        p: {
          es: "Cada técnico lleva los documentos vivos de su flotilla en el bolsillo, presentados para leerse con guantes y sol.",
          en: "Every tech carries the fleet's live documents in their pocket, presented to be read with gloves on and sun overhead.",
        },
      },
      {
        ic: "wifi-off",
        h: { es: "Pensado para una barra de señal", en: "Built for one bar of signal" },
        p: {
          es: "Las respuestas viajan ligeras: texto renderizado, no PDFs de 40 MB. El dato llega aunque la red apenas llegue.",
          en: "Answers travel light: rendered text, not 40 MB PDFs. The datum arrives even when the network barely does.",
        },
      },
      {
        ic: "quote",
        h: { es: "Cita para la bitácora", en: "A citation for the log" },
        p: {
          es: "Cada decisión de campo queda respaldada: respuesta, fuente y hash. Si después alguien pregunta «¿por qué?», está la cita.",
          en: "Every field decision is backed: answer, source and hash. If someone later asks “why?”, the citation is there.",
        },
      },
    ],
    note: {
      es: "Alertas y respuestas son capa administrativa; la operación del ducto o la red sigue en tus sistemas de control.",
      en: "Alerts and answers are an administrative layer; pipeline and network operations stay in your control systems.",
    },
  },
};
