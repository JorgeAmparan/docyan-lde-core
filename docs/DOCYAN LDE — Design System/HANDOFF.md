# Handoff — DOCYAN LDE · Frontend interno (logged-in)

> **Para Opus / Claude Code.** Cómo reconstruir el frontend interno de DOCYAN en el repo `docyan-lde-core`, **pixel-perfect y fiel al prototipo**. Lee también `README.md` (marca, voz, fundamentos) y `colors_and_type.css` (todos los tokens).

## 0 · La regla que manda todo

**`DOCYAN-Prototipo.html` (+ `app/*.jsx`, `app/*.css`) es la ÚNICA fuente de verdad del frontend interno (logged-in).** Lo que el usuario ve al iniciar sesión —en cada rol y vista— se reconstruye **al pie de la letra** desde el prototipo. Si algo en el repo difiere del prototipo, gana el prototipo.

Esto **reemplaza** a los kits de diseño anteriores. `ui_kits/pwa/` y `ui_kits/onboarding/` fueron **retirados**: su alcance (consulta del colaborador, admin, auth + onboarding) está reconstruido —mejor y al día con el modelo comercial vigente— dentro del prototipo. No busques esos kits; ya no existen y no son referencia.

**Qué NO cubre el prototipo (superficies separadas, su propio kit):**
- Sitio público / marketing → `ui_kits/commercial-v2/`. Capa B, **única verdad del sitio público** (modelo de bandas, sin prepago). El repo `(public)/*` ya está construido de aquí y alineado — no requiere rediseño. El kit viejo `ui_kits/commercial/` fue **retirado**.
  - **Demo pública (`/demo`)**: una sola demo = la **consulta del prototipo dentro de marcos de dispositivo** (teléfono ↔ tablet, toggle), con el CoDo MAXI-10ND (3 docs de la mezcladora). Fuente de verdad: superficie **Demo** del prototipo (`app/demo-showcase.jsx`, reusa `ColabMobile` + `ConsultView`). En producción, la consulta libre va contra el backend real (`demoQuery`) — el diseño es el del prototipo.
- Consola del fundador (super-admin de plataforma) → `ui_kits/platform/`. Ya alineada al modelo del prototipo (cupo de ingestas, sin saldo prepagado).

## 1 · El repo ya está cableado — esto NO es reescritura

El frontend del repo (`frontend/src/app`, Next.js 15 + React 19 + Tailwind + shadcn/ui) **ya tiene las rutas y el cableado al backend real**. Varias pantallas ya consumen `/mo/*` y superan al diseño viejo en wiring. **Tu trabajo es traer la UI/UX del prototipo a cada ruta CONSERVANDO el cableado que ya funciona** — no reescribir la lógica de datos. El prototipo manda en lo visual y de interacción; el backend ya conectado se queda.

Misma tecnología: el prototipo es React; el repo es React/Next + TS. Es portar React→TSX, pantalla por pantalla.

## 2 · Mapa prototipo → ruta del repo

El prototipo es un harness con conmutadores: **Entrada/Producto · Organización/Colaborador · Escritorio/Tablet/Móvil**. Cada superficie mapea a una ruta:

### Entrada (pre-login) — `app/entry.jsx`
| Pantalla del prototipo | Ruta del repo |
|---|---|
| Registro freemium | `(auth)/signup` |
| Iniciar sesión | `(auth)/login` |
| Canje de código (piloto −30%) | `(auth)/codigo` |
| Onboarding ájá (5 pasos: bienvenida → primer documento → procesa → primera consulta citada → listo) | `(app)/onboarding` |

### Producto · Organización (admin escritorio) — `app/org-views.jsx`, `app/expediente.jsx`
| Pantalla del prototipo | Ruta del repo |
|---|---|
| Resumen | `(app)/admin` |
| Inteligencia (sugerencias Nivel C → Playbooks Nivel B) | `(app)/saved` + `(app)/playbook/[id]` |
| CoDos · expediente esquemático | `(app)/admin/codos` (+ `[id]`) |
| Documentos vivos (borrar libera cupo) | `(app)/documentos` |
| Ingesta · cotizador (cupo + excedente + conectores) | `(app)/admin/ingesta` |
| Catálogo de schemas (14 tipos) | nueva ruta `(app)/admin/schemas` |
| Glosario + lock terminológico | nueva ruta `(app)/admin/glosario` |
| Usuarios (admins + colaboradores QR + invitar) | `(app)/admin/usuarios` / `(app)/usuarios` |
| Alertas + avisos automáticos por correo | `(app)/admin/alertas` |
| Generar QRs | `(app)/admin/qrs` |
| Gobernanza & FAT | `(app)/admin/gobernanza` |
| Plan (bandas geográficas) + método de pago + código piloto | `(app)/plan` |

### Producto · Colaborador (consulta) — `app/consult.jsx`, `app/colab*.jsx`, `app/answers.jsx`
| Pieza del prototipo | Ruta del repo |
|---|---|
| Shell de consulta (QR → pregunta → respuesta citada) | `(app)/consult` |
| Los renders de respuesta por intención | `(app)/consult/renderers/*` |
| Observaciones del operador (anota sobre la entidad) | dentro de `consult` |

> **Móvil/PWA = el prototipo en su breakpoint chico**, no un kit aparte. `app/colab-mobile.jsx` y `app/admin-mobile.jsx` son las variantes móviles; el swap es por ancho (`isMobile`).

## 3 · Dos ejes del producto (no confundir)

- **Tipo documental (14 schemas)** — `app/schemas.jsx` → `SCHEMAS`. Qué ontología se extrae según la norma del documento. Estado por tipo: activo / parcial / por construir. Es el eje A.
- **Render por intención (8+1)** — `app/answers.jsx`. Cómo se pinta una respuesta: informativa, pasos, troubleshooting (árbol **del manual**, nunca diagnóstico), diagrama, video, historial, alertas, comparativa, + vista bilingüe. Relación muchos-a-muchos con los tipos (cada respuesta traza su tipo de origen).

## 4 · Modelo comercial (vigente — en `app/schemas.jsx`)

- **Setup por ingesta · Modelo 2** (el cliente carga a su ritmo). **No hay saldo prepagado.**
- Cupo de ingestas incluido por plan; al **excedente** se le aplica `MAX($15, costo×25)`, cotizado **antes** de cobrar al método de pago.
- **Planes por documentos vivos × banda geográfica** (`BANDAS` A/B/C): Esencial 50 docs (10+3/mes) · Profesional 300 docs (30+10/mes) · Enterprise 300+ negociado. **Sin "pares lingüísticos"** como diferenciador. Freemium: 3 docs · 30 días.
- Cobro **manual durante el piloto**; Stripe después. Código de piloto = Esencial −30%, 60 días.

> **⚠️ Deriva a corregir en el repo (`(account)/cuenta/*`):** todavía vive el **modelo muerto de saldo prepagado** — `cuenta/recharge/page.tsx` ("Recargar saldo de ingesta", presets de recarga) y `cuenta/page.tsx` (`saldo_actual_usd` + "Recargar"). **Reemplazar por el modelo vigente**: cupo de ingestas del plan + excedente cotizado + **método de pago** (tarjeta/SPEI), tal como la vista **Plan** del prototipo (`app/org-views.jsx` → `PlanView`: bandas + `METODOS_PAGO` + código piloto). Eliminar la ruta `cuenta/recharge` y toda mención de "recargar saldo".

## 5 · Cómo correr el prototipo
Abre `DOCYAN-Prototipo.html`. Sin build: React + Babel + Lucide + IBM Plex desde CDN, y los `app/*.css`. Usa la barra superior para conmutar Entrada/Producto, rol, dispositivo, idioma.

## 6 · No-negociables (del brief)
- **Cinabrio = color de la cita.** Cada respuesta lleva un chip de pedigree cliqueable al span exacto; conserva el motivo corner-bracket.
- **Naming progresivo.** "Playbook" solo cuando se gana; antes es "consulta guardada".
- **Alertas administrativas**, nunca instrucción clínica/operativa. **Línea absoluta:** DOCYAN presenta lo que el documento dice (vencimientos, faltantes); diagnóstico/decisión, jamás.
- **Voz:** directa, sin marketing-speak, sin emoji. Español con *tú*. Mono en mayúsculas solo para etiquetas técnicas.
- **Accesibilidad:** WCAG 2.1 AA; objetivos táctiles ≥44px (guantes); nunca solo color (estado lleva punto/ícono + texto); foco visible.

## 7 · Tokens
**No transcribas a mano — importa `colors_and_type.css`** (variables CSS + clases de tipo) y refléjalo en `tailwind.config`. Headlines: Amate (papel cálido) superficies · Tlilli (tinta cálida) texto · **Tlapalli/cinabrio `#CF4124`** acento único (CTA + cita + foco + QR). IBM Plex Sans/Mono/Serif.

## 8 · Archivos del bundle
- `README.md` — spec profunda de la marca, fundamentos visuales, manifest.
- `colors_and_type.css` — todos los tokens. Reflejar en Tailwind.
- `DOCYAN-Prototipo.html` + `app/*` — **frontend interno · fuente de verdad.**
- `preview/` — tarjetas del design system (un concepto cada una).
- `ui_kits/commercial-v2/` — sitio público (Capa B · única verdad; el repo `(public)/*` ya está alineado).
- `ui_kits/platform/` — consola del fundador (alineada al modelo vigente).
- `assets/`, `fonts/` — marca y tipografías.
- `uploads/` — briefs y catálogos canónicos (modelo comercial, schemas, lock terminológico).
