# Brief de Diseño — Claude Design — B13 Onboarding + Ciclo de uso

**Producto:** DOCYAN LDE — Live Document Environment by XCID
**Para:** Claude Design | **Deriva de:** Sprint Contract B13, `DOCYAN_Modelo_Comercial_Canonico.md`, `DOCYAN_Narrativa_y_Rediseno_Sitio_Publico.md`
**Corre en paralelo** al backend de B13 (Opus). El handoff de estas pantallas se cablea cuando el backend esté listo.
**Fecha:** Junio 2026

---

## Qué diseñar

Las pantallas del **ciclo de entrada y uso del cliente**. NO es el sitio público de marketing (ese es un sprint posterior). Es lo que pasa desde que alguien decide entrar hasta que usa el producto e invita a otros.

Consistencia: usar el design system DOCYAN ya establecido (tokens, IBM Plex, componentes shadcn/Radix con tokens DOCYAN, brand objects DocyanMark/CitationChip/QrFrame). Estas pantallas deben verse parte del mismo producto que la PWA de consulta y la consola del fundador ya diseñadas.

---

## Pantallas

### 1. Signup (Freemium — credenciales primero)
Reemplaza el signup actual de 4 pasos (Plan→Cuenta→Fiscal→Pago), que es el embudo invertido a corregir. El nuevo: **credenciales mínimas** (email + contraseña), sin pedir plan ni datos fiscales ni pago. El usuario entra y vive el producto; el plan viene después. Mensaje de la pantalla: empezar es inmediato y gratis (3 documentos, 30 días). Tono de la narrativa: directo, sin fricción.

### 2. Login
Pantalla de inicio de sesión para quien vuelve. Probablemente ajuste menor del existente. Coherente con el signup nuevo.

### 3. Onboarding — dos fases
- **Fase 1** (tras crear cuenta): bienvenida + primer uso. El usuario llega con su cuenta freemium activa; orientarlo a ingerir su primer documento y hacer su primera consulta. Es el momento "ajá" — que vea el valor (consulta citada) rápido.
- **Fase 2** (cuando elige plan): selección de plan (tres tiers: Esencial / Profesional / Enterprise), con la banda de precios heredada por geolocalización (ajustable). Incluye la **criticidad del segmento** (un paso de configuración). Esta fase aparece cuando el freemium decide pasar a pagado.

### 4. Canje de código (puerta Piloto)
Variante del registro: el usuario llega con un **código de acceso**. Pantalla para ingresarlo al registrarse → entra con plan Esencial-piloto ya activo (mostrar el descuento: precio de lista tachado, precio piloto). Distinto del Freemium: aquí el plan ya está activo al entrar.

### 5. Gestión de documentos
Donde el usuario ve sus documentos vivos, con el **contador del plan** (ej. "2 de 3 documentos"). Acciones: **eliminar** un documento (con confirmación clara — se va de la cuenta), y **cargar/reemplazar** otro. Debe sentirse seguro y reversible en la percepción (confirmación antes de eliminar).

**Aviso de límite freemium (al cargar):** en la pantalla de carga de una cuenta freemium, indicar el límite de forma humana ANTES de subir — "Tu cuenta gratuita incluye hasta 3 documentos, de hasta ~100 páginas cada uno". El usuario conoce la regla antes de chocar con ella.

**Rechazo orientado a conversión (no muro seco):** si un freemium sube un documento de más de 100 páginas, NO mostrar un error técnico de "saldo insuficiente". Mostrar una invitación: el documento es grande (indicar N páginas), supera la cuenta gratuita, y las dos salidas claras — "sube uno más pequeño para probar" o "pasa a un plan pagado para documentos de cualquier tamaño". Es un momento de conversión, no un rechazo: un freemium que sube documentos grandes es buen candidato a cliente. Tono que invita, no que castiga.

### 6. Invitar usuarios
Donde el admin de la cuenta **invita a otros por correo**: campo de email + rol/permiso, botón de enviar. Lista de **invitaciones pendientes** (enviadas, aún no aceptadas) y usuarios activos de la cuenta. Claridad sobre qué puede hacer cada rol.

### 7. Flujo del invitado
Lo que ve quien recibe la invitación: pantalla de **aceptar invitación** (llega desde el enlace del email) → **establecer su contraseña** → queda dentro, listo para consultar. Primera impresión de un invitado: debe entender de inmediato a qué cuenta entra y qué puede consultar.

---

## Principios de diseño

- **Sin fricción en la entrada.** El signup Freemium es lo opuesto al embudo invertido actual: lo mínimo para entrar y ver valor. Cada campo extra en el registro es una barrera; solo email + contraseña.
- **El valor primero, el plan después.** El onboarding lleva al usuario a su primera consulta citada (el momento "ajá") antes de hablar de planes.
- **Coherencia con "contexto integral".** Estas pantallas son parte de la misma historia que el sitio y el producto — no piezas sueltas. Mismo lenguaje visual, mismo tono.
- **Multi-tenant claro.** El invitado debe entender a qué organización pertenece y qué ve. Sin ambigüedad sobre el aislamiento.
- **Móvil real.** El operador puede entrar/consultar desde móvil; las pantallas de consulta y gestión deben funcionar en teléfono, no solo escritorio.

---

## Restricciones firmes

- **No la palabra "traducción"** en ninguna pantalla (regla absoluta del producto). Si aparece lo multilingüe, es "consulta en tu idioma con cita al original".
- **Precios:** una sola fuente, los tres tiers del modelo comercial (Esencial $250 / Profesional $550 / Enterprise desde $1,200 banda A; B +40%; C +50%). No reusar las tablas viejas desactualizadas.
- **No pedir datos fiscales/pago en el registro Freemium.** Eso es fase 2, y solo al activar plan pagado.

---

## Qué NO incluye este brief

El sitio público de marketing (home, producto, verticales, seguridad) — ese es el sprint de rediseño posterior. Aquí solo el ciclo de entrada y uso (login/signup/onboarding/gestión/invitación). Se tocan en el botón de registro, pero son piezas distintas.

---

*Brief de Diseño B13 — DOCYAN LDE™ by XCID — Junio 2026*
*Corre en paralelo al backend (Opus). Handoff se cablea al frontend cuando el backend esté listo.*
