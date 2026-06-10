/**
 * FAQ del sitio público (F3 N1) — copy canónico ES/EN de
 * `DOCYAN_FAQ_Sitio_Publico.md`. NO retraducir: ES y EN vienen provistos. 4 bloques,
 * 17 preguntas. Reglas: sin "traducción"; frecuencia-sí/causa-no; alertas
 * administrativas; sin promesas legales que dependan de los TyC pendientes.
 */
import type { Bilingual } from "@/lib/site-i18n";

export interface FaqEntry {
  id: string;
  q: Bilingual;
  a: Bilingual;
}

export interface FaqBlock {
  id: string;
  title: Bilingual;
  items: FaqEntry[];
}

export const FAQ_BLOCKS: FaqBlock[] = [
  {
    id: "producto",
    title: { es: "Producto y uso", en: "Product & usage" },
    items: [
      {
        id: "que-es",
        q: {
          es: "¿Qué es DOCYAN y en qué se diferencia de un buscador o de un chatbot de IA?",
          en: "What is DOCYAN and how is it different from a search engine or an AI chatbot?",
        },
        a: {
          es: "DOCYAN es un entorno de documentos analizados en vivo. Subes tus documentos tal como están —manuales, fichas técnicas, MSDS, procedimientos— y tu equipo los consulta preguntando en lenguaje natural. La diferencia con un buscador: no te devuelve «el archivo donde quizá está»; te devuelve el dato, presentado para leerse de un vistazo. La diferencia con un chatbot de IA genérico: cada respuesta llega con la cita exacta al fragmento del documento original que la respalda — puedes verificarla a un toque. Si el dato no está en tus documentos, DOCYAN te lo dice; no lo inventa.",
          en: "DOCYAN is a live document environment. You upload your documents as they are — manuals, datasheets, MSDS, procedures — and your team queries them in natural language. Unlike a search engine, it doesn't return “the file where the answer might be”; it returns the answer itself, rendered to be read at a glance. Unlike a generic AI chatbot, every answer comes with an exact citation to the original document passage that supports it — verifiable in one tap. If the answer isn't in your documents, DOCYAN says so; it doesn't make one up.",
        },
      },
      {
        id: "inventa",
        q: { es: "¿La IA puede inventar respuestas?", en: "Can the AI make up answers?" },
        a: {
          es: "Está diseñada para no hacerlo, y para que puedas comprobarlo. Toda respuesta cita el fragmento exacto del documento fuente; si una pregunta no tiene respaldo en tus documentos, DOCYAN responde que no lo encontró en lugar de improvisar. La trazabilidad llega hasta el fragmento original (con verificación de integridad SHA-256 del documento). Esa es la diferencia entre consultar tus documentos con DOCYAN y pegarlos en una IA genérica que responde sin fuente al lado.",
          en: "It's designed not to — and to let you verify it. Every answer cites the exact passage of the source document; when a question has no support in your documents, DOCYAN says it couldn't find it rather than improvising. Traceability goes down to the original passage (with SHA-256 document integrity verification). That's the difference between querying your documents with DOCYAN and pasting them into a generic AI that answers with no source in sight.",
        },
      },
      {
        id: "tipos-documentos",
        q: { es: "¿Qué tipos de documentos puedo subir?", en: "What kinds of documents can I upload?" },
        a: {
          es: "PDF, Word, hojas de cálculo, presentaciones e imágenes escaneadas (con OCR). Manuales técnicos, MSDS, fichas técnicas, certificados de calibración, especificaciones, normas, procedimientos. Los subes como están: no necesitas reformatearlos, limpiarlos ni convertirlos. DOCYAN los analiza tal cual.",
          en: "PDF, Word, spreadsheets, presentations and scanned images (with OCR). Technical manuals, MSDS, datasheets, calibration certificates, specifications, standards, procedures. Upload them as they are: no reformatting, cleanup or conversion needed. DOCYAN analyzes them as-is.",
        },
      },
      {
        id: "multilingue",
        q: {
          es: "El manual me llegó en inglés y mi equipo trabaja en español. ¿Sirve?",
          en: "The manual arrived in English and my team works in Spanish. Does it work?",
        },
        a: {
          es: "Sí — es uno de los usos más comunes. Tu técnico pregunta en español sobre el manual que vino en inglés y recibe la respuesta en español, con la cita al fragmento original en su idioma de origen siempre a un toque. El documento nunca se altera: consultas en tu idioma, verificas contra el original.",
          en: "Yes — it's one of the most common uses. Your technician asks in Spanish about a manual that arrived in English and gets the answer in Spanish, with the citation to the original passage in its source language always one tap away. The document is never altered: you query in your language, you verify against the original.",
        },
      },
      {
        id: "tiempo-ingesta",
        q: { es: "¿Cuánto tarda un documento en estar consultable?", en: "How long until a document is queryable?" },
        a: {
          es: "Minutos, no días. Subes el documento, confirmas, y el análisis corre en automático; la pantalla te muestra el avance y te avisa cuando está listo para consultarse. Un manual típico está vivo el mismo día en que lo subes — sin proyectos de implementación de meses.",
          en: "Minutes, not days. You upload, confirm, and analysis runs automatically; the screen shows progress and tells you when it's ready to query. A typical manual is live the same day you upload it — no months-long implementation projects.",
        },
      },
      {
        id: "decisiones",
        q: { es: "¿DOCYAN toma decisiones o recomienda acciones operativas?", en: "Does DOCYAN make decisions or recommend operational actions?" },
        a: {
          es: "No, y es deliberado. DOCYAN te sirve el dato verificable —la especificación, el procedimiento, el historial— y la decisión la toma tu gente, como lo exige la operación regulada. Las alertas que genera son administrativas (vencimientos, documentos por expirar, fechas de calibración), nunca instrucciones de qué hacer. DOCYAN es capa de conocimiento, no sistema de registro primario ni sistema de decisión.",
          en: "No, by design. DOCYAN serves the verifiable fact — the specification, the procedure, the history — and your people make the decision, as regulated operations require. Its alerts are administrative (expirations, documents about to lapse, calibration dates), never instructions on what to do. DOCYAN is a knowledge layer, not a system of record and not a decision system.",
        },
      },
    ],
  },
  {
    id: "seguridad",
    title: { es: "Tus datos y seguridad", en: "Your data & security" },
    items: [
      {
        id: "donde-viven",
        q: { es: "¿Dónde viven mis documentos y quién puede verlos?", en: "Where do my documents live and who can see them?" },
        a: {
          es: "En un entorno aislado por organización (multi-tenant con aislamiento estricto): tus documentos, tu conocimiento derivado y tus consultas viven separados de los de cualquier otro cliente, y nadie fuera de tu organización tiene acceso. Dentro de tu organización, tú decides quién entra y con qué rol (administrador, editor o solo consulta).",
          en: "In an environment isolated per organization (strict multi-tenant isolation): your documents, derived knowledge and queries live separate from every other customer's, and no one outside your organization has access. Within your organization, you decide who gets in and with which role (admin, editor, or query-only).",
        },
      },
      {
        id: "entrenamiento",
        q: { es: "¿Usan mis documentos para entrenar modelos de IA?", en: "Do you use my documents to train AI models?" },
        a: {
          es: "No. Tus documentos son tuyos y no se usan para entrenar modelos de IA. Para mejorar el producto, DOCYAN utiliza únicamente métricas de uso agregadas y anonimizadas — nunca el contenido de tus documentos ni datos que identifiquen a tu organización.",
          en: "No. Your documents are yours and are not used to train AI models. To improve the product, DOCYAN uses only aggregated, anonymized usage metrics — never the content of your documents or data identifying your organization.",
        },
      },
      {
        id: "cancelacion",
        q: { es: "¿Qué pasa con mis datos si dejo de pagar o cancelo?", en: "What happens to my data if I stop paying or cancel?" },
        a: {
          es: "Hay margen generoso y avisos en cada paso. Si un pago no entra, tienes 7 días de gracia con el entorno plenamente funcional. Después, el entorno se suspende 60 días: sin acceso, pero con tus datos almacenados a salvo, y puedes reactivar en cualquier momento recuperándolo todo. Solo tras agotarse ese periodo se eliminan tus documentos y tu contenido consultable, con una alerta final antes de hacerlo. Los rastros de auditoría se conservan el tiempo que la regulación de tu sector exige.",
          en: "There's a generous runway with notices at every step. If a payment doesn't go through, you get a 7-day grace period with the environment fully functional. Then the environment sleeps for 60 days: no access, but your data stored safely, and you can reactivate at any time and recover everything. Only after that period are your documents and queryable content deleted, with a final alert beforehand. Audit trails are retained for as long as your industry's regulations require.",
        },
      },
      {
        id: "auditoria",
        q: { es: "¿Me sirve ante una auditoría (ISO 17025, IATF 16949, AS9100)?", en: "Does it help in an audit (ISO 17025, IATF 16949, AS9100)?" },
        a: {
          es: "Para eso está construido. La regla de oro de auditoría en industria regulada es el control de la última revisión en el punto de uso — exactamente lo que DOCYAN garantiza: tu gente consulta siempre el documento vigente, cada respuesta es trazable al fragmento exacto de la fuente, y la integridad del documento se verifica con SHA-256. Además, el historial de consultas documenta qué se consultó y cuándo.",
          en: "That's what it's built for. The golden rule of audits in regulated industry is control of the latest revision at the point of use — exactly what DOCYAN guarantees: your people always query the current document, every answer is traceable to the exact source passage, and document integrity is verified with SHA-256. Query history additionally documents what was consulted and when.",
        },
      },
      {
        id: "inteligencia-uso",
        q: { es: "¿Qué información genera DOCYAN sobre el uso de mi equipo?", en: "What information does DOCYAN generate about my team's usage?" },
        a: {
          es: "DOCYAN cuenta, no concluye. Te muestra qué se consulta con más frecuencia y qué temas tu documentación no cubre bien — patrones de frecuencia, nada más. Nunca diagnostica causas, nunca evalúa el desempeño de personas, nunca emite juicios sobre tu operación. Es información para mejorar tu documentación, no para vigilar a tu gente.",
          en: "DOCYAN counts; it doesn't conclude. It shows you what gets queried most often and which topics your documentation doesn't cover well — frequency patterns, nothing more. It never diagnoses causes, never evaluates individual performance, never passes judgment on your operation. It's information to improve your documentation, not to surveil your people.",
        },
      },
    ],
  },
  {
    id: "precios",
    title: { es: "Precios y planes", en: "Pricing & plans" },
    items: [
      {
        id: "como-se-cobra",
        q: { es: "¿Cómo se cobra DOCYAN?", en: "How is DOCYAN billed?" },
        a: {
          es: "Por el tamaño de tu entorno —cuántos documentos vivos mantienes— no por cuántas personas consultan. Hay tres planes (Esencial hasta 50 documentos, Profesional hasta 300, Enterprise a la medida) y todos incluyen todas las capacidades: no hay funciones bloqueadas por plan ni costos por usuario. Los precios completos están en la página de Precios, en la moneda y banda de tu región.",
          en: "By the size of your environment — how many live documents you maintain — not by how many people query. There are three plans (Essential up to 50 documents, Professional up to 300, Enterprise custom) and all include every capability: no features locked behind tiers, no per-user fees. Full pricing is on the Pricing page, in your region's currency and band.",
        },
      },
      {
        id: "por-que-no-usuario",
        q: { es: "¿Por qué no cobran por usuario?", en: "Why don't you charge per user?" },
        a: {
          es: "Porque el valor de DOCYAN crece cuando más gente de tu operación consulta — y cobrarte por cada persona castigaría justo eso. Queremos que el operador, el técnico y el supervisor pregunten sin que tú pienses en licencias. Pagas por los documentos que mantienes vivos; tu gente consulta sin límite de asientos.",
          en: "Because DOCYAN's value grows as more of your operation queries it — and charging per person would punish exactly that. We want the operator, the technician and the supervisor to ask freely without you thinking about licenses. You pay for the documents you keep live; your people query with no seat limits.",
        },
      },
      {
        id: "costo-subir",
        q: { es: "¿Qué cuesta subir documentos?", en: "What does it cost to upload documents?" },
        a: {
          es: "Tu plan incluye un cupo de ingestas: Esencial incluye 10 documentos de arranque más 3 al mes; Profesional, 30 de arranque más 10 al mes; Enterprise se acuerda a tu medida. Los documentos adicionales se cotizan desde $15 USD cada uno — y siempre ves el costo exacto antes de confirmar. Nada se procesa ni se cobra sin tu aprobación previa.",
          en: "Your plan includes an ingestion allowance: Essential includes 10 starter documents plus 3 per month; Professional, 30 starter plus 10 monthly; Enterprise is tailored. Additional documents are quoted from $15 USD each — and you always see the exact cost before confirming. Nothing is processed or charged without your prior approval.",
        },
      },
      {
        id: "probar-sin-tarjeta",
        q: { es: "¿Puedo probar sin tarjeta?", en: "Can I try it without a card?" },
        a: {
          es: "Sí. La cuenta gratuita te da 3 documentos vivos durante 30 días con todas las capacidades — sin tarjeta, sin datos fiscales, sin compromiso. Subes tus propios documentos, consultas con tu equipo, y eliges plan solo si el producto te demostró su valor. También puedes explorar primero los demos por sector, sin registrarte.",
          en: "Yes. The free account gives you 3 live documents for 30 days with every capability — no card, no billing details, no commitment. Upload your own documents, query with your team, and pick a plan only once the product has proven its value. You can also explore the industry demos first, no signup required.",
        },
      },
      {
        id: "piloto-codigo",
        q: { es: "¿Qué es el piloto con código de acceso?", en: "What is the pilot with an access code?" },
        a: {
          es: "Es la puerta acompañada. Si llegaste a DOCYAN por una demo o una relación comercial, recibes un código que activa el plan Esencial con 30% de descuento durante 60 días, con acompañamiento para arrancar con tus documentos y tu equipo reales. Al término, conviertes a plan completo en un clic, conservando todo lo construido.",
          en: "It's the guided door. If you came to DOCYAN through a demo or a business relationship, you receive a code that activates the Essential plan at 30% off for 60 days, with hands-on support to start with your real documents and team. At the end, you convert to a full plan in one click, keeping everything you built.",
        },
      },
    ],
  },
  {
    id: "equipo",
    title: { es: "Para tu equipo", en: "For your team" },
    items: [
      {
        id: "capacitacion",
        q: { es: "¿Mi gente necesita capacitación para usarlo?", en: "Does my team need training to use it?" },
        a: {
          es: "No. Si saben preguntar, saben usar DOCYAN: se consulta escribiendo (o dictando) la pregunta como la dirían en voz alta — «¿cuál es el torque del perno de fijación?», «¿qué EPP requiere este reactivo?». No hay sintaxis que aprender ni menús que memorizar. La curva de adopción típica es la primera consulta.",
          en: "No. If they can ask a question, they can use DOCYAN: you query by typing (or dictating) the question as you'd say it out loud — “what's the torque on the locking bolt?”, “what PPE does this reagent require?”. No syntax to learn, no menus to memorize. The typical adoption curve is the first query.",
        },
      },
      {
        id: "celular",
        q: { es: "¿Funciona en el celular, en el piso de producción?", en: "Does it work on a phone, on the production floor?" },
        a: {
          es: "Está diseñado primero para el celular, porque ahí se necesita: frente al equipo, en la estación, en campo. Las respuestas se presentan para leerse de un vistazo en una pantalla de 6 pulgadas — sin pellizcar PDFs de 80 páginas. También funciona en tablet y escritorio.",
          en: "It's designed mobile-first, because that's where it's needed: in front of the equipment, at the station, in the field. Answers are rendered to be read at a glance on a 6-inch screen — no pinch-zooming through 80-page PDFs. It also works on tablet and desktop.",
        },
      },
      {
        id: "cuantas-personas",
        q: { es: "¿Cuántas personas de mi organización pueden consultar?", en: "How many people in my organization can query?" },
        a: {
          es: "Todas las que necesites — el plan no limita usuarios ni cobra por asiento. Tú administras quién entra y con qué rol: administradores que gestionan el entorno, editores que cargan documentos, y perfiles de solo consulta para el resto del equipo.",
          en: "As many as you need — plans don't cap users or charge per seat. You manage who gets in and with which role: admins who run the environment, editors who load documents, and query-only profiles for the rest of the team.",
        },
      },
      {
        id: "uso-acumulado",
        q: { es: "¿Qué gana mi organización con el uso acumulado?", en: "What does my organization gain from accumulated use?" },
        a: {
          es: "Memoria institucional que no se va con la gente. Cada consulta que hace tu equipo queda en el entorno: DOCYAN te muestra qué se pregunta con más frecuencia y dónde tu documentación tiene huecos, y las rutas de consulta que funcionan se conservan para el siguiente que pregunte. Cuando el técnico veterano se retira, su forma de encontrar las respuestas no se retira con él.",
          en: "Institutional memory that doesn't walk out the door. Every query your team makes stays in the environment: DOCYAN shows you what gets asked most and where your documentation has gaps, and the query paths that work are kept for the next person who asks. When the veteran technician retires, their way of finding answers doesn't retire with them.",
        },
      },
      {
        id: "no-encuentra",
        q: { es: "¿Qué pasa si DOCYAN no encuentra la respuesta?", en: "What if DOCYAN can't find the answer?" },
        a: {
          es: "Te lo dice con honestidad: «esto no está en tus documentos» — en lugar de inventar algo plausible. Y ese vacío es información valiosa: el reporte de patrones te muestra qué preguntas frecuentes tu documentación no cubre, para que sepas exactamente qué documento falta cargar o qué procedimiento falta escribir.",
          en: "It tells you honestly: “this isn't in your documents” — instead of inventing something plausible. And that gap is valuable information: pattern reports show you which frequent questions your documentation doesn't cover, so you know exactly which document to load or which procedure to write next.",
        },
      },
    ],
  },
];

export const FAQ_COUNT = FAQ_BLOCKS.reduce((n, b) => n + b.items.length, 0);
