# CONTRATO DE CORRECCIÓN 02 — Completar fix-01 (3 piezas omitidas)

> **Para Opus / Claude Code.** El Contrato 01 se aplicó **a medias** en el commit `dd73012`.
> Tres cambios pedidos NO se hicieron. Este contrato los completa. **No rehagas lo que ya
> quedó. No toques el cableado al backend.** Solo lo de aquí, tal como está escrito.
>
> Anclajes (ANTES) verificados contra `JorgeAmparan/docyan-lde-core@dd73012`. Si tu working
> tree difiere, alinéate a ese commit antes de aplicar. Dudas ⚠️ → **pregunta a Jorge**.

---

## 0 · Estado real en `dd73012` (qué quedó y qué falta)

| Pieza del Contrato 01 | Estado en `dd73012` |
|---|---|
| `/consult` y `/select-codo` dentro de `OrgShell` (layouts) | ✅ Hecho |
| Entrada "Consultar" (`scan-line`) en el rail | ✅ Hecho |
| `TITLES` de consulta + `isConsultRoute` + `.content.consult` | ✅ Hecho |
| Quitar la lista numerada `<ol className="steps">` de informativa | ✅ Hecho |
| **A · Login aterriza en el dashboard (`/admin/codos`)** | ❌ **Falta** — sigue yendo a `/select-codo` |
| **B · Rail adaptable al plan (free/pro) + etiqueta de plan** | ❌ **Falta** — `NAV` único (pro) y `"Plan Profesional"` hardcodeado |
| **C · Informativa: valor corto en `.big` + quitar chips** | ❌ **Falta** — frase larga sigue en `.big`; chips de desambiguación siguen |

Este contrato hace **solo A, B y C**.

---

## 1 · Cambio A — Login aterriza en el dashboard, no en `/select-codo`

**Archivo:** `frontend/src/app/(auth)/login/page.tsx`

Sigue intacto. Cambia **solo** el destino por defecto (la última línea del `try`, dentro de
`onSubmit`). Conserva el honor de `next=`.

ANTES (verbatim en `dd73012`):
```ts
      setSession(token, user, res.refresh_token ?? null);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/select-codo");
```
DESPUÉS:
```ts
      setSession(token, user, res.refresh_token ?? null);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/admin/codos");
```

> `/admin/codos` es el home del prototipo (`OrgShell` arranca en `view === "codos"`), DENTRO
> del shell. El freemium con 1 documento verá ahí su dashboard con rail — no la página pelona.
>
> ⚠️ Revisa también `signup/page.tsx` y `codigo/page.tsx`: deben ir a `/onboarding` (no a
> `/select-codo`). Si alguno usa `/select-codo` como home, cámbialo a `/admin/codos`.

---

## 2 · Cambio B — Rail adaptable al plan (el freemium tiene su menú)

**Archivo:** `frontend/src/components/org-shell.tsx`

Hoy hay un único `const NAV` (el pro) y `orgPlan` hardcodeado. Pártelo en dos juegos (paridad
con `app/data.jsx → NAV_ORG`) y elígelos por plan. **Nunca ocultes el rail.**

### B.1 — Sustituye el bloque `const NAV: NavEntry[] = [ … ];` por DOS arreglos

ANTES (verbatim en `dd73012`):
```ts
const NAV: NavEntry[] = [
  { group: "Operación" },
  { icon: "layout-dashboard", label: "Resumen", href: "/admin" },
  { icon: "sparkles", label: "Inteligencia", href: "/saved" },
  { icon: "folder-tree", label: "CoDos", href: "/admin/codos" },
  { icon: "scan-line", label: "Consultar", href: "/consult" },
  { icon: "files", label: "Documentos", href: "/documentos" },
  { icon: "bell", label: "Alertas", href: "/admin/alertas" },
  { group: "Administración" },
  { icon: "upload", label: "Ingesta", href: "/admin/ingesta" },
  { icon: "library", label: "Catálogo de schemas", href: "/admin/schemas" },
  { icon: "book-marked", label: "Glosario", href: "/admin/glosario" },
  { icon: "shield-check", label: "Gobernanza & FAT", href: "/admin/gobernanza" },
  { icon: "qr-code", label: "Generar QRs", href: "/admin/qrs" },
  { icon: "users", label: "Usuarios", href: "/admin/usuarios" },
  { icon: "gem", label: "Plan", href: "/plan" },
];
```
DESPUÉS:
```ts
// Paridad con `app/data.jsx → NAV_ORG`. Ambos juegos INCLUYEN "Consultar" (scan-line).
const NAV_PRO: NavEntry[] = [
  { group: "Operación" },
  { icon: "layout-dashboard", label: "Resumen", href: "/admin" },
  { icon: "sparkles", label: "Inteligencia", href: "/saved" },
  { icon: "folder-tree", label: "CoDos", href: "/admin/codos" },
  { icon: "scan-line", label: "Consultar", href: "/consult" },
  { icon: "bell", label: "Alertas", href: "/admin/alertas" },
  { group: "Administración" },
  { icon: "files", label: "Documentos", href: "/documentos" },
  { icon: "upload", label: "Ingesta", href: "/admin/ingesta" },
  { icon: "library", label: "Catálogo de schemas", href: "/admin/schemas" },
  { icon: "book-marked", label: "Glosario", href: "/admin/glosario" },
  { icon: "shield-check", label: "Gobernanza & FAT", href: "/admin/gobernanza" },
  { icon: "qr-code", label: "Generar QRs", href: "/admin/qrs" },
  { icon: "users", label: "Usuarios", href: "/admin/usuarios" },
  { icon: "gem", label: "Plan", href: "/plan" },
];

// Freemium: "Documentos" apunta a la lista de CoDos (vista "codos" del prototipo).
const NAV_FREE: NavEntry[] = [
  { icon: "files", label: "Documentos", href: "/admin/codos" },
  { icon: "scan-line", label: "Consultar", href: "/consult" },
  { icon: "users", label: "Usuarios", href: "/admin/usuarios" },
  { icon: "gem", label: "Plan", href: "/plan" },
];
```
> Nota: en `NAV_PRO`, "Documentos" se movió al grupo **Administración** (como el prototipo).
> Es el único reorden; no muevas nada más.

### B.2 — Elige el juego por plan y corrige la etiqueta

Dentro de `OrgShell`, ANTES (verbatim en `dd73012`):
```ts
  // DESIGN: org identity defaults to canned kit values until /auth/me populates.
  const orgName = user?.org_name ?? "Laboratorio Estándar";
  const orgPlan = "Plan Profesional";
  const userInitials = initials(user?.name ?? user?.email);
```
DESPUÉS:
```ts
  // DESIGN: org identity defaults to canned kit values until /auth/me populates.
  const orgName = user?.org_name ?? "Laboratorio Estándar";
  // ⚠️ El plan sale de la sesión/`/auth/me` (mismo origen que org_name). Si el campo NO existe
  // aún, fallback a "pro" para NO ocultar opciones — y reporta a Jorge que falta exponer `plan`.
  // NUNCA dejes el rail vacío ni oculto.
  const plan = user?.plan === "free" ? "free" : "pro";
  const NAV = plan === "free" ? NAV_FREE : NAV_PRO;
  const orgPlan = plan === "free" ? "Plan gratuito" : "Plan Profesional";
  const userInitials = initials(user?.name ?? user?.email);
```
> El resto de `OrgShell` (el `NAV.map(...)`, el rail, el topbar) **no cambia**: ya consume la
> variable `NAV`, que ahora es la elegida por plan.

### B.3 — Campo `plan` en el tipo de sesión

**Archivo:** `frontend/src/lib/auth.ts` (o donde viva `AuthUser`).
Añade el campo **opcional** para que el plan llegue de `/auth/me` sin romper tipos:
```ts
  plan?: "free" | "pro";
```
> ⚠️ Si el backend aún no manda `plan` en `/auth/me` / `/auth/login`, NO inventes el valor: el
> fallback "pro" mantiene el rail completo. **Confirma con Jorge** que se exponga `plan` para
> que el freemium vea su `NAV_FREE`. No toques otra cosa de `auth.ts`.

---

## 3 · Cambio C — Informativa: valor corto en `.big` + quitar chips

**Archivo:** `frontend/src/app/(app)/consult/renderers/informativa-card.tsx`

Opus ya quitó la lista numerada (✅). Faltan dos cosas que la captura "Aceite?" sigue mostrando:
la **frase larga metida en `.big`** (display gigante) y los **chips de desambiguación**.

### C.1 — Reemplaza el cuerpo por esta versión exacta

ANTES (verbatim en `dd73012`): desde `const especs = …` hasta el cierre del `return`, incluye
el bloque `hasBig = !!primary && (!!primary.valor || !!primary.unidad)` y el bloque
`{payload.match_multiple && …}`.

DESPUÉS (cuerpo completo del componente — mismas props, mismas clases):
```tsx
  const especs = payload.especificaciones ?? [];
  const primary = especs[0];
  const cita = primary?.cita ?? (payload.citas ?? [])[0] ?? null;

  // El slot `.big` (display gigante) es SOLO para un valor corto tipo "85 N·m" o "SAE-30".
  // Una frase NUNCA va en `.big`: se lee como nota. Heurística: hay unidad, o el valor es un
  // token corto sin espacios (no una oración).
  const valor = (primary?.valor ?? "").trim();
  const unidad = (primary?.unidad ?? "").trim();
  const isShortValue = !!unidad || /^[\w.,:/+\-]{1,16}$/.test(valor);
  const hasBig = !!valor && isShortValue;

  // Texto de respuesta: la definición; o el valor cuando trae la prosa (no es número corto).
  const answerText = (payload.definicion ?? "").trim() || (!hasBig ? valor : "");

  return (
    <div className="acard">
      <div className="q">{payload.titulo}</div>

      {hasBig ? (
        <>
          <div className="big">
            {valor}
            {unidad ? <span className="u">{unidad}</span> : null}
          </div>
          {payload.definicion ? <p className="note">{payload.definicion}</p> : null}
        </>
      ) : answerText ? (
        <p className="note" style={{ fontSize: 14.5, color: "var(--fg)" }}>
          {answerText}
        </p>
      ) : null}

      <CitedFragment
        cita={cita}
        saved={saved}
        onSave={onSave}
        onOpenDoc={() => onCite(citaToSource(cita))}
      />
    </div>
  );
```

### C.2 — Qué desaparece respecto a `dd73012`
- ❌ El bloque `{payload.match_multiple && (payload.desambiguacion ?? []).length > 0 && (<div className="ppe">…</div>)}` (los chips). En el prototipo no existen y agregan ruido (ver captura).
- ✅ Queda: título · (valor corto + unidad + nota) **ó** párrafo de respuesta · cita. Nada más.

> ⚠️ Si Jorge quiere conservar la desambiguación para specs ambiguas, se reañade **solo como
> chips `.ppe`**, jamás como lista. **Pregúntale; no lo decidas tú.**

### C.3 — Recordatorio de datos (verificación, NO código)
La frase larga venía en `especificaciones[0].valor` **desde el backend**. La guardia evita que
se vea gigante, pero la respuesta ideal es que el motor mande un valor corto (o la prosa en
`definicion`). **Repórtalo a Jorge** — no se parcha más en el front.

---

## 4 · Criterios de aceptación

- [ ] Tras login, el usuario aterriza en **`/admin/codos`** con rail + topbar (no en `/select-codo`).
- [ ] Un usuario **pro** ve `NAV_PRO` (con "Consultar" entre CoDos y Alertas; Documentos en Administración) y la etiqueta "Plan Profesional".
- [ ] Un usuario **free** ve `NAV_FREE` (Documentos · Consultar · Usuarios · Plan) y "Plan gratuito".
- [ ] Con `plan` desconocido, se muestra `NAV_PRO` completo — **el rail nunca queda vacío ni oculto**.
- [ ] "Aceite?" (y cualquier informativa con prosa) se ve como **título + párrafo breve + cita**: sin número gigante con una oración, **sin** fila de chips, **sin** lista numerada.
- [ ] Una informativa con valor corto real (p. ej. "85" + "N·m") **sí** usa el display `.big`.
- [ ] `npm run build` / `tsc` pasan. Sin variables muertas (`extras` ya no existe; `desambiguacion` ya no se usa en informativa).
- [ ] Cableado al backend intacto: `/auth/login`, `/mo/query`, `/mo/codos`, sesión, doc-tabs, guardar, overlay de cita.

---

## 5 · Prohibiciones

1. ❌ No rehagas lo que ya quedó en `dd73012` (layouts, entrada Consultar, títulos, quitar el `<ol>`).
2. ❌ Nada de lógica de datos/backend. Solo redirect + nav + render informativa + el campo `plan?` del tipo.
3. ❌ Jamás ocultar el rail (sin plan → fallback `pro`).
4. ❌ No renombrar rutas/clases/componentes; clases verbatim.
5. ❌ No inventar el valor de `plan` ni forzar el `kind` de respuesta.
6. ❓ Dudas ⚠️ (campo `plan`, desambiguación) → **preguntar a Jorge antes**.

---

## 6 · Archivos tocados (lista cerrada)

| Acción | Archivo |
|---|---|
| editar (1 línea) | `frontend/src/app/(auth)/login/page.tsx` (`/select-codo` → `/admin/codos`) |
| editar | `frontend/src/components/org-shell.tsx` (NAV_PRO + NAV_FREE + selección por plan + etiqueta) |
| editar | `frontend/src/lib/auth.ts` (`AuthUser.plan?: "free" \| "pro"`) |
| editar | `frontend/src/app/(app)/consult/renderers/informativa-card.tsx` (guardia `.big` + quitar chips) |
| ⚠️ verificar | `frontend/src/app/(auth)/signup/page.tsx`, `codigo/page.tsx` (no aterrizar en `/select-codo`) |

**Ningún otro archivo se toca en este contrato.**
