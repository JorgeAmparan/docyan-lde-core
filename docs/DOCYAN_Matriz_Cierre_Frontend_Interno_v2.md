# DOCYAN LDE™ — Matriz de Cierre del Frontend Interno · v2 (instrucción única de Opus)

**Qué es:** el documento único contra el que Opus construye y cierra. Reemplaza el "%" auto-reportado y absorbe el punch list (P1–P5) + las 4 decisiones de Jorge ya resueltas. Opus verifica cada ítem funcionando end-to-end; no deja nada para que Jorge lo pruebe o complete.

**Regla que manda (handoff §0):** `DOCYAN-Prototipo.html` + `app/*` es la ÚNICA fuente de verdad. Si el repo difiere, gana el prototipo. Reconstrucción **verbatim**, no interpretación.

**Regla de cierre — sin escapatoria:**
- El único estado de cierre es **`✅ HECHO`** = funciona end-to-end (front **y** backend si lo requiere) + diff verbatim contra el prototipo + **Opus lo verificó funcionando** (lo ejercitó él mismo, no lo dejó para que alguien más lo pruebe).
- Estados de trabajo: `🔧 EN CURSO`. Nada más.
- **NO existe "pendiente-backend", "después", "próximo sprint", "estado honesto mientras tanto", ni "pendiente de Jorge".** Si un ítem necesita backend, **el backend es parte del ítem y se construye en este desarrollo.** El mismo Opus toca front y back; no hay otro equipo ni otra fecha. Opus no deja nada para que Jorge lo pruebe o complete: Opus cierra todo lo que es ejecutable.
- **Prohibido reportar porcentaje.** Se reporta por ID: `B3 HECHO`, `P2 EN CURSO`. "87%" no es un estado.

---

## YA CERRADO (verificado por commit — confirmar en recorrido final)

| ID | Ítem | Commit | Estado |
|---|---|---|---|
| D1 | Consulta dentro del shell (`/consult`, `/select-codo` con rail) | dd73012 | ✅ |
| D2 | "Consultar" en el rail | dd73012 | ✅ |
| D3 | Informativa sin lista numerada | dd73012 | ✅ |
| D4 | Login aterriza en `/admin/codos` | 6bdbf69 | ✅ |
| D5 | Rail adaptable free/pro + etiqueta de plan | 6bdbf69 | ✅ |
| D6 | Informativa: guardia de valor corto + quitar chips | 6bdbf69 | ✅ |
| D7 | Rail/shell hover-expand 66→224 (verbatim) | dbb7b88 | ✅ |
| B-admin | Ingesta, Schemas, Glosario, Usuarios, Alertas, QRs, Gobernanza, Plan | — | ✅ FIEL (confirmado en auditoría) |

---

## TRABAJO DE ESTE DESARROLLO — cada ítem cierra completo (front+back), sin diferir

### P1 · Expediente del CoDo — hueco grande
- **Archivo:** `frontend/src/app/(app)/admin/codos/_expediente.tsx` · **Fuente:** `app/expediente.jsx`
- **Qué falta (portar 1:1, clases verbatim):** rama "Relaciones inmediatas" del árbol (`exp-tg`/`exp-node`); `RelDetail` (`exp-rel`, `er-head`, `er-tag`, `er-banner`, `er-cite`); en `DocDetail`: bloque de sugerencias (`ed-block`/`ed-sug`) y recursos de apoyo (`rec-item`/`add-q`); etiquetas de doc (`en-tag`).
- **Backend:** wirear a los datos reales del grafo (relaciones / sugerencias / recursos). **Si el grafo no expone relaciones inmediatas o sugerencias, se construye la consulta/endpoint del grafo que las expone — en este desarrollo.** No se pinta con datos muertos ni se difiere.
- **Cierre:** diff verbatim vs `expediente.jsx` + las relaciones/sugerencias salen del grafo real

### P2 · Búsqueda global — no portado
- **Archivos:** nuevo `frontend/src/components/search-modal.tsx` + `org-shell.tsx` (wire input→modal) · **Fuente:** prototipo (`dcSearch`)
- **Qué falta:** el input del header es `readOnly` muerto; el prototipo abre modal (documentos / CoDos / preguntas).
- **Backend:** Opus confirma si existe endpoint de búsqueda sobre el tenant. **Si existe, cablea. Si NO existe, lo construye** (búsqueda sobre documentos/CoDos/preguntas del tenant) y luego cablea. Las dos mitades en este desarrollo.
- **Cierre:** modal verbatim del prototipo + búsqueda funciona de verdad contra el backend

### P3 · Consulta — verificar que el backend diferencia la intención
- **Archivo:** `frontend/src/app/(app)/consult/consult-data.ts` (L67) · **Fuente:** `app/answers.jsx`
- **Qué falta:** (a) el fallback silencioso a "info" ante `kind` desconocido enmascara fallas → cambiar a error explícito/log, no "info". (b) verificar en vivo si el motor diferencia la intención (mismo `kind` para todo = el síntoma "todo se ve igual" persiste).
- **Backend:** si la verificación muestra que el clasificador de intención misclasifica o manda un solo `kind`, **se corrige el clasificador de intención en este desarrollo.** No se parcha el front para tapar un backend que no diferencia.
- **Cierre:** fallback endurecido + tabla pregunta→`kind` recibido (≥5 preguntas parafraseadas, kinds correctos y distintos)

### P4 · Cuenta — consolidar a 1 página *(decisión de Jorge: el prototipo es ley)*
- **Archivos:** `frontend/src/app/(account)/cuenta/page.tsx` (+ subrutas) · **Fuente:** prototipo (clases `.acct-*`)
- **Qué se hace:** consolidar las 4 subrutas en **1 página** con secciones Perfil + Organización + Seguridad y clases `.acct-*` del prototipo, conservando los datos reales del backend. **Borrar las subrutas.**
- **Cierre:** diff verbatim + 1 sola página + datos reales

### P5 · Resumen — datos reales, no hardcodeados
- **Archivo:** `frontend/src/app/(app)/admin/page.tsx` (L114, L154)
- **Qué falta:** `▲ 4%` y `2 alertas` están hardcodeados.
- **Backend:** vienen del dato real del backend. **Si el backend no expone esas métricas, se construye su cálculo/endpoint en este desarrollo.** Alternativa válida solo si la métrica genuinamente no aplica aún: mostrar `—`, nunca un número fabricado.
- **Cierre:** diff + métricas reales del backend (o `—` honesto)

### P6 · Deriva del modelo muerto de saldo prepagado *(handoff §4)*
- **Archivos:** `(account)/cuenta/recharge/page.tsx` (eliminar ruta + toda mención "Recargar saldo"); `cuenta/page.tsx` (`saldo_actual_usd` + "Recargar").
- **Qué se hace:** eliminar el modelo de saldo prepagado; reemplazar por cupo del plan + excedente cotizado + método de pago (modelo vigente, vista Plan). *(Se integra con P4 al ser la misma página de cuenta.)*
- **Cierre:** ruta `recharge` eliminada + cero menciones de "recargar saldo" (grep) + modelo vigente en su lugar.

### P7 · Render bilingüe (9º tipo) — se construye completo *(decisión de Jorge: es MVP, no se difiere)*
- **Fuente:** prototipo (`BilingualAnswer`). Función ya decidida: consultar documento en EN → respuesta en ES. **NO es traducción rigurosa** (esa sigue descartada); es Nivel 1/2 de la Adenda Lingüística, núcleo del producto.
- **Qué se hace:** render bilingüe del prototipo (front) **+ el payload bilingüe del backend que lo alimenta.** Las dos mitades en este desarrollo.
- **Cierre:** render verbatim + el backend manda el payload bilingüe + consulta real EN→ES citada

---

## DECISIONES DE JORGE — resueltas, integradas como hechos (no se reabren)

| Tema | Decisión |
|---|---|
| Render bilingüe | **Se construye completo** (P7). Es MVP. Traducción rigurosa sigue descartada — esto no es eso. |
| Cuenta 1 página vs subrutas | **1 página, el prototipo es ley** (P4). Borrar subrutas. |
| Chips de desambiguación en informativa | **NO se reañaden.** El render es cita según la pregunta (cuenta, no concluye). El prototipo ya es correcto. *(Distinto de la selección de variantes del lock terminológico, que es config del glosario por el admin — no chips en la respuesta del operador.)* |
| Búsqueda global | **Se construye end-to-end** (P2). Si falta endpoint, se construye aquí. |

---

## NO-NEGOCIABLES TRANSVERSALES (se verifican en cada ítem) — handoff §6
1. **Cinabrio `#CF4124` = color de la cita.** Chip de pedigree cliqueable al span; corner-bracket conservado.
2. **Naming progresivo:** "Playbook" solo cuando se gana; antes "consulta guardada".
3. **Alertas administrativas, jamás clínica/operativa.** Línea absoluta.
4. **Voz:** directa, sin marketing-speak, sin emoji, español con *tú*. Mono mayúsculas solo etiquetas técnicas.
5. **Accesibilidad WCAG 2.1 AA:** táctil ≥44px; nunca solo color; foco visible.
6. **Tokens:** importar `colors_and_type.css` + reflejar en `tailwind.config`. No transcribir a mano.
7. **Cableado conservado:** UI del prototipo entra conservando el wiring real existente. Verbatim en lo visual, intacto/extendido en lo de datos.

---

## ORDEN DE EJECUCIÓN (peor-primero)
P1 (expediente, hueco grande + grafo) → P5/P6 (datos deshonestos + modelo muerto) → P7 (bilingüe front+back) → P4 (consolidar cuenta) → P2 (búsqueda global front+back) → P3 (verificar+corregir intención).

## EVIDENCIA POR ÍTEM
Diff verbatim vs el archivo del prototipo + tsc/CI verde + funcionamiento end-to-end verificado por Opus + URL de preview. (El build local inestable no es excusa de cierre — Opus verifica contra el backend desplegado.)

---

## REGLA DE CIERRE FINAL
El frontend interno está **HECHO** cuando **todas** las filas P1–P7 están `✅ HECHO` (funcionando end-to-end, no solo front, verificado por Opus) y la deriva eliminada. Mientras una fila no funcione completa, NO está hecho — y se nombra cuál por su ID, nunca un porcentaje. **Ningún ítem cierra a medias entre front y back. Opus cierra todo lo ejecutable; no deja nada para que Jorge lo pruebe o complete.**

---
*Matriz de Cierre v2 · DOCYAN LDE™ by XCID · Junio 2026.*
*Cada ítem cierra completo: front + backend + verbatim + confirmación. Sin "pendiente". Sin "%". Sin "después".*
