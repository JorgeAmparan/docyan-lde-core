# CONTRATO DE CORRECCIÓN 01 — Consulta dentro del shell + render informativa

> **Para Opus / Claude Code.** Esto es un **contrato**, no una sugerencia. Corrige tres
> desviaciones del repo `docyan-lde-core@main` respecto a la fuente de verdad
> (`DOCYAN-Prototipo.html` + `app/*.jsx`). **No rediseñes nada. No toques el cableado
> al backend.** Solo lo que está aquí escrito, tal como está escrito.
>
> Si algo no está en este contrato, **no lo hagas**. Si crees que falta algo, **pregunta
> a Jorge antes de actuar** — no improvises.

---

## 0 · Las tres desviaciones (qué reporta el usuario, y la causa real)

| # | Síntoma del usuario | Causa exacta en el repo |
|---|---|---|
| 1 | "La consulta la muestra **fuera del dashboard**" | `(app)/consult` es ruta full-screen; `(app)/layout.tsx` *"adds no chrome"*; no pasa por `OrgShell`. |
| 2 | "El **menú no es igual**" | `components/org-shell.tsx → NAV` **borró la entrada "Consultar"** (`scan-line`) que el prototipo tiene tras CoDos. |
| 3 | "La respuesta parece un **instructivo**" | `consult/renderers/informativa-card.tsx` pinta las specs extra como `<ol className="steps">` (lista numerada). El prototipo nunca lo hace. |

La verdad del prototipo: **Consultar es una vista DENTRO de `OrgShell`** (`view === "consultar"`,
con header + rail visibles) y aparece en el rail con ícono `scan-line` justo después de CoDos.
Ver `app/data.jsx → NAV_ORG.pro` y `DOCYAN-Prototipo.html → OrgShell`.

---

## 1 · Alcance

### SÍ se hace (y nada más)
1. Añadir la entrada **"Consultar"** al rail de `OrgShell`.
2. Hacer que `/consult` (y `/select-codo`) se rendericen **dentro de `OrgShell`** (rail + topbar visibles).
3. Quitar la **lista numerada** del render informativa (`InformativaCard`).

### NO se hace (prohibido en este contrato)
- ❌ NO tocar `api`, `useQuery`, `/mo/query`, `/mo/sessions`, `/mo/codos`, `useAuth`, ni la lógica de sesión/`session_id`/`documento_id`. **El cableado al backend se queda intacto.**
- ❌ NO borrar `/select-codo` ni su lógica — solo se mete dentro del shell.
- ❌ NO meter `OrgShell` en `(app)/layout.tsx` (eso envolvería también `onboarding` y `q-public` → MAL).
- ❌ NO renombrar rutas, componentes, ni clases CSS. Cada `className` se conserva **verbatim**.
- ❌ NO inventar datos enlatados (regla B9.5 §2.5). Si el motor falla, el error honesto se queda.
- ❌ NO "mejorar", reordenar ni rediseñar la vista de consulta, el rail, ni los demás renders.
- ❌ NO tocar la vista móvil/embedded del `ConsultView` (el `embedded` y `consult-embed` se quedan igual).

---

## 2 · Cambio A — Rail: devolver la entrada "Consultar"

**Archivo:** `frontend/src/components/org-shell.tsx`

### A.1 — En el array `NAV`, insertar "Consultar" entre "CoDos" y "Alertas"

ANTES:
```ts
  { icon: "folder-tree", label: "CoDos", href: "/admin/codos" },
  { icon: "files", label: "Documentos", href: "/documentos" },
  { icon: "bell", label: "Alertas", href: "/admin/alertas" },
```

DESPUÉS:
```ts
  { icon: "folder-tree", label: "CoDos", href: "/admin/codos" },
  { icon: "scan-line", label: "Consultar", href: "/consult" },
  { icon: "files", label: "Documentos", href: "/documentos" },
  { icon: "bell", label: "Alertas", href: "/admin/alertas" },
```

> Orden y grupo idénticos al prototipo (`NAV_ORG.pro`): Resumen · Inteligencia · CoDos ·
> **Consultar** · … (Documentos y Alertas siguen). NO muevas Documentos.

### A.2 — En el mapa `TITLES`, añadir el título de consulta

ANTES (primeras filas):
```ts
const TITLES: Record<string, string> = {
  "/admin": "Resumen general",
```

DESPUÉS:
```ts
const TITLES: Record<string, string> = {
  "/admin": "Resumen general",
  "/consult": "Consultar",
  "/select-codo": "Consultar",
```

### A.3 — `.content` a altura completa en consulta (paridad con el prototipo)

El prototipo hace `<div className={"content" + (isConsult ? " consult" : "")}>` para que la
vista de consulta (dos columnas, `consult-desktop`) ocupe todo el alto. Replica el modificador.

En el `return` de `OrgShell`, donde está:
```tsx
        <div className="content">{children}</div>
```
cámbialo por:
```tsx
        <div className={"content" + (isConsultRoute(pathname) ? " consult" : "")}>{children}</div>
```
y añade junto a los demás helpers del archivo:
```ts
function isConsultRoute(pathname: string): boolean {
  return pathname === "/consult" || pathname === "/select-codo";
}
```

> Si la clase `.content.consult` no existe ya en el CSS del shell, añádela con la MISMA regla
> del prototipo (full-height, sin padding extra) — **no inventes** otra cosa: copia la del
> prototipo (`app/app.css` / `views.css`, selector `.content.consult`).

---

## 3 · Cambio B — Meter `/consult` y `/select-codo` dentro de `OrgShell`

`(app)/layout.tsx` "no añade chrome" **a propósito** (para que `onboarding` y `q-public`
queden limpios). Por eso el shell se aplica **por ruta**, igual que `(app)/admin/layout.tsx`
ya hace. Crea dos layouts mínimos que envuelven en `OrgShell`.

### B.1 — Nuevo archivo: `frontend/src/app/(app)/consult/layout.tsx`
```tsx
import { OrgShell } from "@/components/org-shell";

/**
 * Capa A · Consulta DENTRO del shell de la org (paridad con el prototipo:
 * `view === "consultar"` vive en `OrgShell`, con rail + topbar visibles).
 * NO es full-screen. El cableado de `consult/page.tsx` (CoDo activo → /mo/query)
 * NO cambia: solo se le devuelve el chrome.
 */
export default function ConsultLayout({ children }: { children: React.ReactNode }) {
  return <OrgShell>{children}</OrgShell>;
}
```

### B.2 — Nuevo archivo: `frontend/src/app/(app)/select-codo/layout.tsx`
```tsx
import { OrgShell } from "@/components/org-shell";

/** La selección de CoDo previa a consultar también vive dentro del shell. */
export default function SelectCodoLayout({ children }: { children: React.ReactNode }) {
  return <OrgShell>{children}</OrgShell>;
}
```

### B.3 — Limpiar el comentario engañoso de `(app)/layout.tsx`
El comentario dice que la consulta "owns its inner layout" full-screen. Ya no es cierto.
**No cambies el código** de `(app)/layout.tsx` (sigue siendo passthrough `<>{children}</>`),
solo corrige el comentario para que no vuelva a justificar sacar la consulta del shell:

ANTES (fragmento del comentario):
```
 * (built separately) and the full-screen consult view can each own their inner
 * layout. Intentionally minimal: it only renders children.
```
DESPUÉS:
```
 * (admin, consult y select-codo) traen su propio OrgShell vía layout de ruta.
 * Este layout es passthrough a propósito: NO añade chrome aquí para no envolver
 * onboarding ni las rutas públicas. Intentionally minimal: it only renders children.
```

> **Guardrail crítico:** NO pongas `OrgShell` en `(app)/layout.tsx`. Solo en los layouts
> de `consult/`, `select-codo/` y el ya existente `admin/`.

### B.4 — `consult/page.tsx`: el redirect a `/select-codo` se queda
No lo toques. Sigue siendo correcto: si no hay CoDo activo, manda a `/select-codo` — pero
ahora `/select-codo` **también** está dentro del shell, así que el usuario nunca sale del
dashboard. El render `return <ConsultView context={context} />;` no cambia.

---

## 4 · Cambio C — Informativa = valor + nota (sin instructivo)

**Archivo:** `frontend/src/app/(app)/consult/renderers/informativa-card.tsx`

El prototipo (`app/answers.jsx → InfoAnswer`) pinta SOLO: título · número grande + unidad ·
nota · cita. **Nunca** una lista numerada. Elimina el bloque que convierte las specs extra
en `<ol className="steps">`.

### C.1 — Borrar el bloque de specs como pasos

BORRAR ÍNTEGRO este bloque:
```tsx
      {extras.length > 0 && (
        <ol className="steps">
          {extras.map((e, i) => (
            <li key={i}>
              <span className="st">
                {e.nombre}
                {e.valor ? `: ${e.valor}${e.unidad ? " " + e.unidad : ""}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
```

Y elimina la línea que lo alimenta (ya no se usa):
```tsx
  const extras = especs.slice(1);
```

### C.2 — Lo que SÍ queda en `InformativaCard` (estado final exacto)
- `payload.titulo` en `.q`.
- Si hay valor/unidad: `.big` con `primary.valor` + `.u` con `primary.unidad`, y `payload.definicion` en `.note`.
- Si NO hay valor pero sí `definicion`: `.note` como texto (igual que hoy).
- `<CitedFragment cita={cita} … />` al final.
- **Se elimina** el `<ol className="steps">`.

### C.3 — Desambiguación (`match_multiple` → `.ppe` chips)
El prototipo NO la muestra, pero es UX real para specs ambiguas. **Decisión:** se permite
conservar el bloque `match_multiple && desambiguacion` como **chips `.ppe`** (no es un
instructivo). Lo que **no** se permite es renderizar specs como lista numerada. Si Jorge
prefiere paridad estricta con el prototipo, también se quita — **pregúntale, no decidas tú.**

### C.4 — Nota de clasificación (verificación, NO código)
Si una pregunta que el prototipo trata como informativa (p. ej. *"¿A cuántas RPM gira la
olla?"*, *"¿Qué aceite usa el motor?"*) vuelve del backend como `procedure_card` →
`GuiaPasoAPaso`, eso es un problema de **clasificación de intención del backend**, NO se
parcha en el front forzando el render. **Repórtalo a Jorge** con la pregunta exacta y el
`payload.kind` recibido. El front pinta fielmente el `kind` que llega; no lo falsea.

---

## 5 · Criterios de aceptación (todos deben cumplirse)

- [ ] El rail de la org muestra **Consultar** (ícono `scan-line`) entre CoDos y Documentos, en el grupo Operación.
- [ ] Al entrar a `/consult`, **se ven el rail y el topbar** de `OrgShell` (no es full-screen). El topbar dice "Consultar".
- [ ] La entrada "Consultar" queda **activa** (`isActive`) cuando `pathname === "/consult"`.
- [ ] `/select-codo` también se renderiza **dentro del shell** (rail + topbar visibles).
- [ ] `onboarding` y las rutas públicas (`q-public`, `(public)/*`) **siguen SIN** rail (no se les coló `OrgShell`).
- [ ] Una respuesta informativa con varias `especificaciones` ya **no** se ve como lista numerada; es número grande + nota + cita.
- [ ] El cableado al backend funciona igual: `/mo/query`, sesión, `documento_id`, doc-tabs, guardar consulta, overlay de cita — **sin cambios de comportamiento**.
- [ ] `npm run build` / `tsc` pasan. Sin imports muertos (p. ej. `extras` ya no existe).

---

## 6 · Prohibiciones (resumen para no desviarte)

1. ❌ Nada de lógica de datos/backend. Solo placement + render informativa.
2. ❌ `OrgShell` **jamás** en `(app)/layout.tsx`.
3. ❌ No borrar `/select-codo`.
4. ❌ No renombrar rutas/clases/componentes.
5. ❌ No rediseñar la consulta ni el rail ni otros renders.
6. ❌ No inventar datos ni forzar `kind` de respuesta.
7. ❓ Cualquier duda (incluido C.3) → **preguntar a Jorge antes**, no improvisar.

---

## 7 · Archivos tocados (lista cerrada)

| Acción | Archivo |
|---|---|
| editar | `frontend/src/components/org-shell.tsx` (NAV + TITLES + `.content` modifier) |
| crear | `frontend/src/app/(app)/consult/layout.tsx` |
| crear | `frontend/src/app/(app)/select-codo/layout.tsx` |
| editar (solo comentario) | `frontend/src/app/(app)/layout.tsx` |
| editar | `frontend/src/app/(app)/consult/renderers/informativa-card.tsx` |

**Ningún otro archivo se toca en este contrato.**
