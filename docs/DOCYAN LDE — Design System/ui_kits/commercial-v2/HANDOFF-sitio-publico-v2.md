# DOCYAN LDE™ — Handoff: Rediseño del Sitio Público v2

**De:** Claude Design → **Para:** Opus (Sprint Contract → Next.js 15 + Tailwind)
**Fuente de verdad visual:** esta carpeta (`ui_kits/commercial-v2/`), prototipo React clickeable.
**Documentos rectores:** `DOCYAN_Brief_ClaudeDesign_Rediseno_Sitio_Publico.md` (uploads/) y el canónico de Narrativa donde haya duda.
**Fecha:** Junio 2026

---

## 1. Qué se entrega

Prototipo completo y verificado del sitio público rediseñado: **7 páginas** + infraestructura de conversión. Una sola historia con el arco gancho → foso → garantía; la maquinaria de conversión (puertas, precios, geo) conectada al final del arco sin interrumpirlo.

| Página | Archivo | Ruta Next.js sugerida |
|---|---|---|
| Home (arco en miniatura, 3 variantes de hero) | `home.jsx` | `/` |
| Producto (narrativa de significado, 4 capas, híbrido editorial) | `producto.jsx` | `/producto` |
| Cómo funciona (sin caja negra, grafo-vs-RAG, línea multilingüe) | `como.jsx` | `/como-funciona` |
| Verticales (hub con paraguas transversal + 3 detalles) | `verticales.jsx` | `/verticales`, `/verticales/[slug]` |
| Seguridad (+ "DOCYAN cuenta, no concluye") | `seguridad.jsx` | `/seguridad` |
| Precios v2.1 (única tabla del sitio) | `precios.jsx` | `/precios` |
| Demos sin registro — 5 CoDos | `codos.jsx` + `codo-data.jsx` | `/demo`, `/demo/[codo]` |

Soporte: `shared.jsx` (nav, footer, i18n, bandas, puertas, banner geo), `demo.jsx` (demo vivo del hero), `demo-doc.html` (visor del documento fuente — mock de PDF que aterriza en el span resaltado), `site2.css` (todos los estilos, mobile-first), `app.jsx` (router del prototipo).

## 2. Sistema visual

- Tokens en `../../colors_and_type.css` — **ya compatibles** con los kits previos: `--amate-*`, `--ink-*`, `--cinnabar-*` (#CF4124), `--radius-*`, `--shadow-*`, `--font-sans/mono/serif` (IBM Plex Sans/Mono/Serif).
- `site2.css` consume solo esos tokens; traducir sus clases a Tailwind con la config de tokens existente. Sin colores nuevos.
- Objeto de marca: corner-bracket de cita (`.cite2 .brk`) — aparece en cada respuesta citada. Es el contrato visual del producto; no simplificarlo a un ícono genérico.
- 2 fondos de banda: amate claro (default/`paper`) y `ink` (tinta) para foso, puente CoDos y count-band. No introducir más.

## 3. Responsive (requisito duro)

- **Mobile-first en todas las páginas de narrativa** — la audiencia de campo lee en celular.
- Header: **una sola fila, 60–64px**. Links visibles ≥980px; debajo, hamburguesa → sheet superior con links, CTAs apilados (48px de alto) y selector banda/idioma. Nunca layout vertical que crezca en altura.
- Breakpoints usados: 560 / 640 / 680 / 720 / 760 / 880 / 920 / 980 / 1020px. Grids colapsan a 1 columna en móvil; hit targets ≥44px.

## 4. Embudo (reglas que no se negocian)

1. CTA primario en TODO el sitio: **"Pruébalo gratis — 3 documentos" → `/signup`** (ya en producción, NO se rediseña). Secundario: "Agendar demo" → `/codigo` (piloto, Esencial −30%: lista tachada → precio oferta, 60 días).
2. **CoDos = escalón intermedio**, nunca compiten con el freemium: viven en `/demo`, en el puente de la home (sección ink, después del foso, antes de sectores/cierre) y en cada página de vertical. CTA de salida de cada CoDo: **"Ahora con tus documentos →" → /signup**.
3. **No existe flujo Plan→Fiscal→Pago en la puerta.** La decisión comercial llega después de vivir el producto.
4. En el prototipo, los enlaces a producción abren un modal (`LinkOutModal`); en producción son `<Link>` directos a `/signup`, `/codigo`, `/login`.

## 5. Precios v2.1 (fuente única)

- **Una sola tabla en todo el sitio** (`precios.jsx`). Cualquier otra mención de precio enlaza aquí.
- Línea de producto: DOCYAN (hoy) · DOCYAN Data (próximamente, sin precio) · DOCYAN Field (próximamente, sin precio).
- Tiers por **documentos vivos**, no por usuarios; todas las capacidades en todos los tiers: Esencial ≤50 · Profesional ≤300 (recomendado) · Enterprise 300+/a la medida ("desde").
- Bandas USD/mes: A (MX·LatAm) 250/550/1,200 · B (US·CA) 349/770/1,680 · C (UE·UK·AU) 375/825/1,800. Piloto −30% sobre Esencial de la banda activa.
- **Ingestas incluidas** (mensaje de generosidad, nunca "setup por documento"): Esencial 10 iniciales + 3/mes · Profesional 30 + 10/mes · Enterprise negociado. Adicionales **desde $15 USD**, cotizados transparentes antes de confirmar. No exponer fórmula interna.

## 6. Geo + i18n

- Estado global: `lang` (es/en) + `band` (A/B/C), persistidos (prototipo: localStorage; producción: cookie + ruteo `/mx`, `/us`… por locale en Next.js; el onboarding hereda).
- Detección preselecciona ambos; **siempre ajustables**: banner discreto de primera visita (desechable) + `GeoCtl` en footer y en Precios + pill de idioma en nav.
- Copy completo ES y EN en los `t({es,en})` de cada componente — extraer a diccionarios. Idioma consistente por vista, sin mezclas.
- Los CoDos de demo están intencionalmente en español (documentos de muestra en su idioma original — coherente con la narrativa). El demo del hero demuestra la consulta multilingüe: MSDS en inglés, pregunta en español, span original intacto.

## 7. Restricciones absolutas (verificadas en el prototipo; conservar)

1. La palabra **"traducción" no aparece** en ninguna página. Es "consulta multilingüe con respuesta citada en tu idioma".
2. **"DOCYAN cuenta, no concluye"** — explícito en Seguridad (count-band con ejemplos sí/no) y reiterado en foso y vertical maquila.
3. "Entorno de documentos analizados en vivo", nunca "plataforma de conocimiento" sin matiz.
4. **Live Document Environment** (no "Living Document Engine").
5. Capa de conocimiento, no sistema de registro primario; alertas administrativas, nunca decisión clínica/operativa (presente en Cómo funciona, Seguridad y cada vertical).
6. Una sola tabla de precios (§5).
7. `/signup` y `/codigo` ya existen — solo se enlazan.

## 8. Componentes interactivos a cablear

- **Cita funcional → documento (en ambos demos), divulgación progresiva en 3 niveles**:
  1. **Chip de cita corner-bracket** → despliega el span citado *inline* dentro de la tarjeta (rápido, no interrumpe).
  2. **Botón "Abrir PDF"** → abre el **overlay modal del documento** (`DocOverlay`, en `demo.jsx`): hoja centrada (bottom-sheet en móvil <560px), encabezado con cita/título/idioma original, cuerpo tipo página con el **span resaltado** en contexto, pie con sello "Pedigree a span exacto · SHA-256". Cierra con X, clic fuera o Escape. **Decisión UX deliberada: modal, no pestaña nueva** — audiencia móvil, no expulsar al visitante del embudo, y `window.open` es frágil (popup blockers / webviews).
  3. Dentro del overlay, **"Abrir en pestaña nueva ↗"** → documento completo (`demo-doc.html?doc&cite&page&span&codo&lang`; producción: visor real de PDF con highlight de span y scroll a página) — para quien quiere quedarse leyendo.

  El documento se muestra siempre en su **idioma original** (param/prop `lang`) — nunca una copia reescrita. En producción: mismo orden de niveles; la pestaña nueva es apropiada solo en la PWA autenticada (trabajo real, referencia lado a lado).
- **Demo vivo del hero** (`demo.jsx`): 2 documentos reales, consultas preparadas con respuesta citada + span original; input libre con 3 capas (match exacto → match por palabras clave → llamada al backend de consulta real con timeout 9s → fallback honesto). El botón de envío usa manejador de clic directo (no depender solo del submit del form). Al responder, auto-scroll para que la respuesta quede visible (crítico en móvil: la respuesta aparece arriba del input).
- **CoDos** (`codos.jsx`): 8 tipos de render de respuesta (info, steps con EPP/advertencia, diagram con pins, troubleshoot interactivo, compare con diff, alerts, history, video con capítulos) — son los mismos intent-renders del producto; reutilizar componentes de la PWA si existen.
- **Selector de banda**: re-renderiza precios en vivo (tiers + piloto tachado) sin recargar.

## 9. Pendientes que NO resuelve este handoff

- Fotografía documental de campo: todos los slots usan placeholder rayado con etiqueta mono de qué foto va (7 escenas por sector + verticales).
- Privacidad/Términos: placeholder honesto (`LegalPage`) hasta la postura de PI — no inventar contenido legal.
- CoDo de Flotillas no existe (los 5 CoDos son lab/maq/pharma/min/agri); la página de Flotillas enlaza al hub de demos. Decidir si se produce un sexto CoDo.
- Las 3 variantes de hero (A split / B pregunta / C campo) quedan como decisión de negocio — conmutables en el panel Tweaks del prototipo. Implementar solo la elegida.
- SEO/metadata por página y ruteo localizado: definidos a nivel de intención (§6), no implementados en el prototipo.

---

*Del presente handoff deriva el Sprint Contract de Opus. Donde el prototipo y el brief canónico difieran, rige el canónico.*
