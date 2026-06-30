# DOCYAN LDE™ — Lock Terminológico y Glosario de Consulta — Canónico

**Documento arquitectónico canónico · DOCYAN LDE™ by XCID**
**Estatuto:** Consolida y profundiza la §5 de `DOCYAN_Adenda_Linguistica_y_Inteligencia_de_Consulta.md` (que sigue vigente como marco). Rige específicamente sobre el lock terminológico y el glosario en la capa de consulta. Par de `DOCYAN_Adenda_PostPoC.md` y `DOCYAN_Vision_Propuesta_de_Valor.md`.
**Naturaleza:** Descriptivo (qué y por qué). El Sprint Contract del lock se deriva de este documento, no al revés.
**Origen:** Definiciones de §5 (junio 2026) + refinamientos de sesiones de construcción posteriores (selección de variantes por usuario, encuadre como diferenciador vs CAT tools, integración con el catálogo normativo de dos anillos).
**Alcance:** SOLO el lock terminológico y el glosario como función de consulta. No es documento de traducción. El lock pertenece al entorno de consulta, no al motor de traducción (Nivel 4, post-MVP).

---

## 0. Qué es y qué no es el lock terminológico

**Es:** una **función técnica del entorno de consulta** que impone, como restricción dura sobre el modelo, el término correcto de un glosario gobernado en el momento de generar contenido en el idioma del usuario. El LLM aporta fluidez; el glosario aporta corrección terminológica regulatoria. Ninguno solo es suficiente.

**No es:**
- Una instrucción verbal al modelo ("por favor usa estos términos"). Es restricción dura, no sugerencia.
- Una función del motor de traducción rigurosa (Nivel 4). Vive en la capa de consulta, desde el MVP.
- Una CAT tool. Las CAT tools gestionan memorias de traducción para producir documentos traducidos; el lock de DOCYAN gobierna la terminología de una **consulta viva** sobre el documento, en el punto de uso. (Ver §6, diferenciación.)

**Por qué importa (la razón de su existencia):** el render asistido (Nivel 2 — mostrar el fragmento del documento traducido al idioma del usuario) es **inseguro sin lock**. Un MSDS donde "flammable: NONE" se traduce como "inflamable" en vez de "no inflamable", o donde `shall` se colapsa a `should`, es bonito y peligroso. El glosario y el render asistido se construyen juntos o ninguno: como el render asistido es MVP, el lock es MVP.

---

## 1. Los tres componentes del glosario (base canónica, §5.1)

### (a) Los datos — estructura de la tabla de equivalencias
Indexada por **par lingüístico** y por **marco normativo/dominio**. Cada entrada contiene, como mínimo:
- término origen
- término(s) destino *(ver §2 — pueden ser varios: variantes)*
- par lingüístico (p. ej. EN→ES)
- marco/dominio de procedencia (norma mecánica, regulatorio, MSDS, dominio del cliente)
- **categoría de obligatoriedad** cuando aplique — crítico para regulatorio: `shall / must / should / may` → equivalentes en destino con su carga preservada, para **no colapsar la obligatoriedad**. Esta es la entrada de mayor valor regulatorio: un sistema que traduce `shall` como `debería` cambia una obligación en una recomendación.

### (b) Los tres orígenes de las entradas
1. **Glosarios públicos existentes** — terminología de normas (ISO, NOM), terminología técnica estándar por dominio. *(Conecta con el catálogo normativo: las NOM mexicanas del Anillo 1 —precacheables, texto público vía DOF— son fuente directa de terminología normativa. Las ISO/IATF del Anillo 2 —restringidas por copyright— aportan terminología vía la copia licenciada del propio cliente, no por redistribución.)*
2. **Entidades del propio grafo** — términos que el grafo ya identificó como entidades al ingerir el documento. Reutiliza el trabajo de ingesta: no se construye el glosario desde cero, se siembra de lo que el grafo ya extrajo.
3. **Aportados/validados por el cliente** — nomenclatura interna del cliente. **Este origen crea activo propietario:** el glosario validado de un cliente, contra sus normas, es algo que un competidor con mejor modelo no puede replicar. Es foso (Nivel 3 de valor de la Visión).

### (c) El lock en el momento de consulta — el mecanismo
Antes de que el LLM genere el render asistido, DOCYAN:
1. Extrae del fragmento los términos presentes en el glosario aplicable (por par lingüístico + dominio del documento).
2. Se los **impone al modelo como restricción dura**: "traduce este fragmento, pero estos términos van exactamente así, con esta carga de obligatoriedad".
3. El modelo genera con fluidez dentro de esa restricción.

Esto operacionaliza "lock terminológico como función técnica, no instrucción verbal" — la decisión estructural ya presente, ahora con mecanismo definido en la capa de consulta.

---

## 2. Selección de variantes por usuario *(refinamiento canónico, nuevo)*

Un mismo término origen puede tener **varias equivalencias válidas en destino**, legítimas y dependientes del contexto del usuario, su región o su convención corporativa. Ejemplo canónico: `torque` (EN) → en español técnico de la industria coexisten **"par de apriete", "torsión", "torque"** según la planta, el país y la norma corporativa. Ninguna es "la correcta" universal; la correcta es **la que el cliente usa**.

**Definición:**
- El glosario admite **múltiples variantes destino** por término origen dentro de un mismo par lingüístico (la estructura de §1(a) lo soporta: término destino es un conjunto, no un escalar).
- El **usuario/organización selecciona la variante canónica** para su tenant — qué término prefiere ver. Esa selección se persiste y gobierna el render para ese tenant.
- Una vez seleccionada, **el lock impone esa variante de forma consistente** en todas las consultas de ese tenant. La consistencia es el valor: el operador siempre lee "par de apriete", nunca una mezcla aleatoria de las tres según lo que el modelo prefiera ese día.

**Por qué es un diferenciador y no un capricho:** la consistencia terminológica gobernada por el cliente, a través de todas sus consultas, es precisamente lo que una IA genérica no da (genera una variante distinta cada vez) y lo que una CAT tool da solo dentro de un proyecto de traducción cerrado, no en consulta viva. El cliente fija su nomenclatura una vez; DOCYAN la respeta siempre.

---

## 3. Modelo, no SLM especializado *(base canónica, §5.2)*

Decisión canónica: **no** perseguir un SLM/NMT de traducción especializado. Un modelo de traducción dedicado da consistencia pero pierde el razonamiento contextual necesario para resolver ambigüedad terminológica usando el grafo. Se usa el **LLM de consulta con el glosario inyectado en contexto** como restricción.

La especialización vive en **el glosario y el grafo** —que el cliente y DOCYAN controlan—, no en el modelo. Esto es:
- Más defendible (el activo es el glosario gobernado, no un modelo que cualquiera puede igualar).
- Consistente con el Model Router existente.
- Coherente con que el lock sea capa de consulta, no motor de traducción.

---

## 4. Carga de obligatoriedad regulatoria *(profundización)*

El caso de mayor criticidad del lock no es la fluidez, es **preservar la fuerza normativa**. En documentos regulados:
- `shall` / `must` = obligación → debe mapear a un equivalente que conserve la obligación ("deberá", "debe"), nunca a "debería".
- `should` = recomendación → "debería", "se recomienda".
- `may` = permiso/opción → "puede", "podrá".

El glosario marca esta categoría (§1(a)) y el lock la impone. Colapsar una obligación en recomendación —o al revés— en un MSDS, una NOM o un procedimiento de seguridad no es un error de estilo: cambia el significado regulatorio del documento. Por eso esta categoría es de obligatoriedad dura en el glosario, no opcional.

**Línea absoluta (heredada):** el lock garantiza fidelidad terminológica; NO convierte el render en traducción certificada. El render asistido siempre lleva su marca ("traducción asistida — fuente en [idioma]") y, para contenido de criticidad alta (valores de seguridad, límites de exposición, obligaciones normativas), se muestra **junto** al original, no en reemplazo. DOCYAN informa, no certifica.

---

## 5. Relación con el catálogo normativo y los dos anillos *(integración)*

El glosario se nutre del catálogo normativo (los 14 tipos de schema derivados de norma) y de la biblioteca normativa de referencia, con la distinción de copyright de dos anillos:

- **Anillo 1 — NOM mexicanas (DOF, texto público):** precacheables como texto compartido. Su terminología normativa puede sembrar el glosario público (origen 1) directamente.
- **Anillo 2 — ISO / IATF / AS y normas privadas (copyright restringido):** NO se redistribuyen. Su terminología entra al glosario del cliente vía **su copia licenciada en su tenant privado**, no por redistribución de DOCYAN. El valor de DOCYAN es hacer consultable la norma que el cliente ya licenció, incluida su terminología — no republicar contenido protegido.

Esta distinción gobierna de dónde puede DOCYAN tomar terminología para el glosario público vs. qué queda confinado al glosario privado del tenant.

---

## 6. Diferenciación vs CAT tools *(encuadre canónico)*

El lock terminológico es el **diferenciador defendible** de DOCYAN frente a las CAT tools (Trados, MemoQ, Phrase, XTM, SmartCAT) — pero la diferencia no es "mejor lock", es **distinta naturaleza**:

| | CAT tool | Lock de DOCYAN |
|---|---|---|
| Propósito | Producir un documento traducido | Gobernar la terminología de una consulta viva |
| Momento | Proyecto de traducción cerrado | Punto de uso, en tiempo real |
| Quién consulta | Traductor/revisor | Operador, técnico, en campo |
| Salida | Documento entregable | Fragmento consultado con fuente al lado |
| Glosario | Memoria del proyecto | Activo gobernado del tenant, multi-origen, con variantes seleccionables |

DOCYAN **no compite** con las CAT tools: el lock es propiedad del **entorno de consulta**. Una CAT tool no consulta un documento en el punto de uso vía QR con provenance clickeable; DOCYAN sí, y el lock es lo que vuelve esa consulta multilingüe confiable. (Nota: Jorge puede eventualmente operar como LSP diferenciado usando DOCYAN como su propia herramienta — línea de negocio separada, no add-on del producto.)

---

## 7. Consecuencias de construcción *(referencia para el Sprint Contract — este documento NO lo genera)*

- **Glosario como estructura (afecta B1/DKG):** tabla de equivalencias por par lingüístico + marco normativo, con categoría de obligatoriedad y **soporte de múltiples variantes destino por término** (§1a, §2). Las entidades terminológicas del grafo alimentan el glosario (origen 2).
- **Selección de variante por tenant (§2):** superficie de configuración donde la organización fija su variante canónica; persistencia por tenant; el lock la respeta en todas las consultas.
- **Lock en el pipeline de render asistido (Nivel 2):** extracción de términos del glosario presentes en el fragmento → inyección como restricción dura antes de la generación → preservación de la carga de obligatoriedad.
- **Cotizador:** el render asistido genera tokens de salida traducidos por fragmento — el cotizador contempla este costo, no solo el de ingesta. *(Coherente con el gate de costo del núcleo.)*
- **Frontend de consulta:** marca de procedencia visible ("traducción asistida — fuente en [idioma]"); span original a un toque; criticidad alta junto al original, no en reemplazo.
- **Integración con catálogo normativo (§5):** el glosario distingue terminología de Anillo 1 (pública, sembrable) vs Anillo 2 (licenciada, confinada al tenant).

---

## 8. Lo que este documento NO autoriza (límites duros)
- **No** presentar el render con lock como traducción certificada (producto ni marketing).
- **No** colapsar la carga de obligatoriedad regulatoria (`shall`≠`should`).
- **No** redistribuir terminología de normas de Anillo 2 (copyright) fuera del tenant licenciado.
- **No** sustituir el LLM de consulta por un SLM de traducción especializado (§3).
- **No** imponer una variante terminológica única universal cuando el cliente tiene la suya — la selección es del tenant (§2).
- **No** mover el lock al motor de traducción (Nivel 4): es función de consulta, MVP.

---

## 9. Resumen de estatuto

| Materia | Estatuto | Relación con §5 de la Adenda Lingüística |
|---|---|---|
| Glosario tres componentes (datos/orígenes/lock) | MVP · canónico | Base de §5.1, sin cambio |
| Selección de variantes por usuario | MVP · refinamiento nuevo | Profundiza §5.1(a) — término destino como conjunto |
| Carga de obligatoriedad regulatoria | MVP · profundización | Explicita §5.1(a) |
| LLM + glosario, no SLM | MVP · canónico | §5.2, sin cambio |
| Integración dos anillos | MVP · integración nueva | Conecta con catálogo normativo |
| Diferenciación vs CAT tools | Encuadre canónico | Aditivo |

---

*Documento arquitectónico canónico — Lock Terminológico y Glosario de Consulta.*
*Consolida §5 de la Adenda Lingüística + refinamientos de construcción. Fuente de verdad para el Sprint Contract del lock terminológico, a derivar cuando llegue su turno.*
*XCID SA de CV — DOCYAN LDE™ by XCID — Junio 2026*
