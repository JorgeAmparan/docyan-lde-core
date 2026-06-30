# DOCYAN LDE™ — Brief para Claude Design: Rediseño Integral del Sitio Público

**Producto:** DOCYAN LDE — Live Document Environment by XCID
**Documento:** brief de diseño. Deriva de `DOCYAN_Narrativa_y_Rediseno_Sitio_Publico.md` (canónico); ese documento rige donde haya duda. Del handoff de este brief deriva el Sprint Contract de Opus.
**Alcance:** el CONJUNTO del sitio público — no páginas sueltas. El entregable es un sistema coherente.
**Fecha:** Junio 2026

---

## 0. Qué es DOCYAN (para quien diseña)

DOCYAN convierte los documentos de una organización en conocimiento consultable al instante, donde se necesita, por quien lo necesita. El operador frente a la máquina pregunta en su idioma y recibe la respuesta renderizada para leerse de un vistazo, **con cita trazable al documento original**. No es un buscador de PDFs ni un chatbot: es un entorno de documentos analizados en vivo.

Producto real y en producción: docyan-lde.vercel.app. El sitio público existente se rediseña; no se parte de cero.

---

## 1. Principio rector — Contexto integral

El sitio cuenta **una sola historia coherente**. Cada página es un capítulo, no una ficha independiente. Toda página, sección y componente debe pasar esta prueba:

> *¿Esto refleja la propuesta de valor integral de DOCYAN, o es una pieza suelta?*

**Regla de pitch que gobierna el arco:** entrar por el **gancho** (consulta viva), revelar el **foso** adentro (inteligencia organizacional), presentar lo lingüístico como **garantía** (no como producto).

La narrativa enamora; el embudo convierte. **No se mezclan:** la narrativa de significado vive en Producto y alimenta la home; la maquinaria de conversión (puertas, precios, geolocalización) se conecta al final del arco sin interrumpirlo.

---

## 2. Sistema visual existente (se conserva y se respeta)

- **Paleta:** raíz náhuatl cálida — amate (fondos), tlilli/ink (tinta), tlapalli/cinnabar `#CF4124` (acento).
- **Tipografía:** IBM Plex.
- **Objeto de marca:** la marca de cita de esquinas (corner-bracket) — es la firma visual del producto (la cita trazable ES el producto). Úsala con intención en el sitio.
- **Coherencia con el producto:** el sitio público y la PWA autenticada deben sentirse el mismo producto. La landing respira más; la identidad no cambia.

El demo en vivo de la home (subir documento → preguntar → respuesta con cita clickeable a span) ya existe y funciona — se conserva como pieza central del gancho.

---

## 3. La narrativa transversal — cuatro capas

**Principio de transversalidad:** estructura única, anclajes múltiples. El relato es uno; las escenas son específicas para que cada perfil se reconozca al menos una vez.

**Perfiles a anclar (al menos una escena reconocible cada uno):** gerente/ingeniero de maquila (termoformado, ensamble) · jefe de flotilla de técnicos de gasoductos/telecom · operación en plataforma marina/petrolera · cuadrilla de minería · frente de construcción vial · piso de producción agroindustrial · cliente de laboratorio de pruebas (ISO 17025).

### Capa 1 — El momento *(universal + anclajes por sector)*
La escena que todos han vivido: **estás frente al equipo, con el reloj corriendo; el dato existe, pero no lo encuentras.** Navegas carpetas, abres el manual de 80 páginas en el móvil, pellizcas para leer. El costo es real: tiempo muerto, decisión a ciegas, o esperar a "quien sabe". Tono: lenguaje de campo, físico, reconocible. No genérico.

### Capa 2 — El paradigma *(anaquel → FLOW)*
Cambio de categoría, no de grado. Analogía Blockbuster→Netflix:
- **Modelo anaquel (hoy):** buscas dónde está. Tienes que saber qué archivo, qué carpeta, qué página. El conocimiento está inmóvil.
- **Modelo FLOW (DOCYAN):** preguntas qué necesitas. El dato viene a ti, presentado para leerse de un vistazo, con su fuente. Sin pellizcar, sin navegar, sin perder el momento.

DOCYAN como **categoría nueva** (entorno de documentos vivos), no como buscador mejor.

### Capa 3 — La confianza *(consulta multilingüe + gobernanza · SIN la palabra "traducción")*
Preguntas en tu idioma; DOCYAN responde **en tu idioma**, con la **cita al documento original real y trazable**. Consulta asistida por IA **sin alucinaciones**: pedigree a span, umbrales por criticidad, freno de alucinación, cadena SHA-256.

**El reemplazo seguro del acto inseguro que ya hacen:** hoy suben documentos a IA genérica para "entenderlos" — sin fuente, sin trazabilidad, copiando datos regulados a herramientas no controladas, y la IA inventa. DOCYAN hace ese mismo gesto natural vuelto seguro, citado y trazable.

### Capa 4 — El foso *(inteligencia organizacional)*
El "y además" que se revela una vez entendido el gancho: cada consulta que hace tu gente **teje el saber de la organización**. Cuando el experto se va, su forma de resolver no se va con él — la rotación deja de ser fuga. DOCYAN muestra qué se pregunta mucho y qué la documentación no cubre bien.

**DOCYAN cuenta, no concluye:** reporta frecuencia y patrón, nunca diagnostica causas ni juzga la operación.

---

## 4. Arco del sitio — rol y ajustes por página

| Página | Rol narrativo | Qué cambia |
|---|---|---|
| **Home** | Arco completo en miniatura (gancho → demo vivo → problema → cómo funciona → niveles → gobernanza → casos). | **Conservar estructura.** CTA primario pasa a **"Pruébalo gratis — 3 documentos"** (→ /signup). "Agendar demo" pasa a secundario (→ contacto/Piloto). Completar Capa 3 (consulta multilingüe, sin "traducción"). |
| **Producto** | **La narrativa de significado** — las 4 capas completas, transversal con anclajes por sector. Tono de one-pager: momento de campo, paradigma anaquel→FLOW, significado. NO duplica la home: aquí DOCYAN se vuelve significado. | Página con rol propio y fuerte (antes floja). Es la página nueva de mayor peso de este rediseño. |
| **Cómo funciona** | El "sin caja negra" para público técnico (CIOs/TI). | Conservar grafo-vs-RAG, clasificación de intención, SHA-256. CTA al embudo nuevo. Completar línea multilingüe. |
| **Verticales** | Especificidad por sector (SEO + reconocimiento). | Conservar páginas por sector (el dolor vívido de Laboratorios — "la calibración venció y nadie lo vio a tiempo" — es el modelo a seguir). **Añadir** la firma del trabajo transversal como paraguas que une sectores: trabajo técnico regido por documentos · criticidad del error · punto de uso lejos de oficina · conectividad no garantizada · fuga de conocimiento tácito. |
| **Seguridad** | Confianza para industria regulada. | Conservar todo (multi-tenancy, RLS, SHA-256, jurisdicción, on-premise Enterprise). **Añadir** sección frecuencia-sí/causa-no: "DOCYAN cuenta, no concluye" — el argumento de no-juicio operativo. |
| **Precios** | Maquinaria de conversión. | **Rehacer completa.** Ver §5. |

---

## 5. Precios y maquinaria de conversión

### 5.1 Página de precios (fuente única — elimina las tres tablas divergentes)

**Línea de productos** (dos decisiones simples, no matriz):
1. ¿Qué producto? **DOCYAN** (hoy, precio firme) · **DOCYAN Data** (próximamente, sin precio) · **DOCYAN Field** (próximamente, sin precio).
2. ¿De qué tamaño? Tres tiers por documentos vivos (NO por usuarios — todas las capacidades en todos los tiers, sin add-ons):

| Tier | Documentos vivos | Banda A (MX/LatAm) | Banda B (US/CA) | Banda C (UE/UK/AU) |
|---|---|---|---|---|
| **Esencial** | hasta 50 | **$250 USD** | $349 | $375 |
| **Profesional** | hasta 300 | **$550 USD** | $770 | $825 |
| **Enterprise** | 300+ / a la medida | **desde $1,200 USD** | desde $1,680 | desde $1,800 |

**Ingestas incluidas** (mensaje clave de la página): cada plan **incluye documentos de arranque + cupo mensual** — Esencial: 10 iniciales + 3/mes · Profesional: 30 iniciales + 10/mes · Enterprise: negociado. **Adicionales desde $15 USD**, cotizados transparentes antes de confirmar (cliente carga a su ritmo). El mensaje es generosidad ("incluye"), nunca peaje ("setup por documento"). No exponer la fórmula interna.

**Eliminar:** "pares lingüísticos", "Demo sin trial gratuito", y toda tabla/precio que no sea esta fuente única.

### 5.2 Las dos puertas
- **Freemium (puerta principal, autoservicio):** 3 documentos, 30 días. CTA primario de todo el sitio → **/signup** (ya construido y en producción). Registro mínimo → vive el producto → elige plan después.
- **Piloto (asistido):** código de acceso, Esencial -30% (banda A: ~~$250~~ → **$175/mes**, precio de lista visible y tachado), 60 días → **/codigo** (ya construido). "Agendar demo"/contacto desemboca aquí.

**Embudo corregido (el cambio mayor):** se elimina el flujo Plan→Fiscal→Pago en la puerta. Probar es la puerta principal; la decisión comercial llega después de vivir el producto.

### 5.3 Geolocalización
Detección preselecciona **banda de precios + idioma**; ambos ajustables manualmente por el usuario. Ruteo a URL localizada (`/mx`, `/us`…) por locale en Next.js. Vive en la capa pública; el onboarding hereda.

### 5.4 Higiene
- Idioma de navegación consistente (no mezclar es/en en una misma vista).
- Privacidad/Términos: **placeholders honestos** hasta la postura de PI (pendiente pre-pilotos). No inventar contenido legal.

---

## 6. Restricciones firmes (no se cruzan)

1. **La palabra "traducción" NO aparece en el sitio.** El mensaje es consulta multilingüe con respuesta citada en tu idioma. Las analogías muestran consulta (el técnico pregunta en español sobre el manual que vino en otro idioma y recibe respuesta en español con el span original a un toque), nunca "DOCYAN traduce el manual".
2. **Frecuencia-sí/causa-no absoluto:** DOCYAN cuenta, no concluye. Explícito en Seguridad.
3. **No llamar a DOCYAN "plataforma de conocimiento" sin matiz:** es "entorno de documentos analizados en vivo". "Conocimiento vivo" sobreafirma.
4. **Nombre correcto:** Live Document Environment (no "Living Document Engine").
5. **Línea regulatoria:** capa de conocimiento, no sistema de registro primario; alertas administrativas, nunca decisión clínica/operativa.
6. **Una sola tabla de precios** en todo el sitio.
7. **Los flujos /signup y /codigo ya existen en producción** — el sitio apunta a ellos, no los rediseña.

---

## 7. Entregable esperado

Handoff de diseño del **conjunto**: home + Producto (nueva, la de mayor peso) + Cómo funciona + Verticales (con paraguas transversal) + Seguridad (con no-juicio) + Precios (rehecha), con navegación coherente, CTAs del embudo nuevo en todas las páginas, y los componentes de geolocalización (selector de banda/idioma). Sistema visual continuo con la PWA. Responsive completo — la audiencia de campo lee en móvil.

Del handoff deriva el Sprint Contract de Opus para el cableado.

---

*DOCYAN LDE™ by XCID — Brief de Diseño: Rediseño Integral del Sitio Público — Junio 2026*
*Deriva del documento canónico de Narrativa y Rediseño. El canónico rige donde haya duda.*
