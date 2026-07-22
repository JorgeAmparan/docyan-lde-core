# Sprint Contract ED-1 — Backend Pilar 2: Alertas completas + base de Eventos Dirigidos

XCID SA de CV — DOCYAN LDE™ — Julio 2026
Repo: `docyan-lde-core` · Rige: `DOCYAN_Adenda_Eventos_Dirigidos.md` §1, §2, §4, §5 · Prerequisito: ED-0 (mergeado, desplegado, verificado)

**Modo de operación:** UNA aprobación (este contrato) + ejecución completa + UN reporte final. Sin iteración multi-fase. Verdad operacional sobre proyección optimista. CI es la autoridad. La única razón válida para no construir algo: dependencia técnica real, documentada en el reporte.

---

## 1. Contexto (estado auditado, no re-verificar desde cero)

Las alertas hoy se generan al cierre de ingesta (`alerts/generador.py`) y se sirven pull vía pipeline Tipo 7. Todo lo demás está incompleto o muerto:
- `DocyanScheduler` construido pero **nunca arrancado** en prod (sin lifespan).
- `evaluate_vencimientos` es stub (loggea y retorna).
- `ReglaAlerta` = label declarado, jamás escrito/leído. `AccionSobreAlerta` = inexistente (solo docstring en `tipo7_alertas.py:6`).
- **Ninguna alerta emite notificación.** Email solo existe para invitaciones de onboarding (`email.py`, factory SMTP).
- `admin/alertas/page.tsx` es mock (`guardar()` = `toast.success`, sin API).
- Módulos `eventos/`, `alerts/`, `notifications/` independientes, sin base común.

Este sprint convierte el Pilar 2 en funcional de punta a punta y deja la base común que ED-2 (Solicitudes) reutiliza.

## 2. Alcance

### 2.1 Módulo base `app/eventos_dirigidos/`

Base común que alertas consumen ahora y solicitudes en ED-2. Contiene:

1. **Ciclo de vida común:** `creado → notificado → leído → reconocido → en_proceso → resuelto | escalado | cancelado`. Máquina de estados con transiciones válidas explícitas; transición inválida = error, no silencio. Cada transición registra evento FAT (extender la familia de eventos FAT existente con familia `evento_dirigido`).
2. **Motor de notificación** (§2.4 abajo).
3. **Resolución de destinatarios** contra el Directorio (§2.5 abajo).

Los módulos existentes `eventos/`, `alerts/`, `notifications/` se reconcilian consumiendo esta base — no crear una cuarta ruta paralela. Refactor mínimo necesario, sin romper contratos existentes del pipeline T7.

### 2.2 Scheduler arrancado + `evaluate_vencimientos` real

1. `DocyanScheduler` se instancia y arranca en el **lifespan** de la app FastAPI (y se detiene limpio al shutdown). Guard para no duplicar scheduler si corren 2 máquinas: lock Redis (`SETNX` con TTL renovable) — solo una instancia ejecuta jobs; la otra queda standby.
2. `evaluate_vencimientos` (cron 6am) deja de ser stub: barrido real sobre el grafo por tenant — `:CertificadoVigencia`/`FechaVencimiento` y equivalentes de los schemas activos — evaluando thresholds de las `ReglaAlerta` del tenant. Crea `:Alerta` nuevas cuando una fecha cruza un threshold.
3. **Idempotencia:** no crear alerta duplicada para el mismo (entidad, fecha, threshold) ya alertado. Clave de deduplicación persistida en la propia `:Alerta`.
4. Cada corrida del job registra FAT (inicio, tenants procesados, alertas creadas, errores).

### 2.3 `ReglaAlerta` y `AccionSobreAlerta` vivas

1. **`ReglaAlerta`** persistida (nodo FalkorDB por tenant + espejo operacional en Supabase si el patrón existente lo pide para listados): thresholds de días (lista, ej. [30, 15, 7]), urgencia por threshold, destinatarios (refs al Directorio), canales (`email`, `in_app`), regla de escalación (N días en estado `notificado` sin `reconocido` → notificar a destinatario de escalación). Defaults sembrados por tenant al onboarding (migración/función que también siembre tenants existentes).
2. **`AccionSobreAlerta`:** acciones `reconocer | iniciar_proceso | escalar | postponer (con justificación obligatoria) | suprimir | resolver | comentar` — exactamente las del doc 01. Cada acción = transición del ciclo de vida común + registro de quién/cuándo/justificación + evento FAT.
3. **Endpoints:** router de alertas dedicado (`/alertas`): listar por tenant/entidad con filtros de estado y urgencia, detalle, y un endpoint por acción (o uno de acciones con payload tipado). El payload de listado mantiene compatibilidad con `AlertsDashboardPayload` del pipeline T7 (no romper la Consulta).
4. **Escalación automática:** job del scheduler que evalúa la regla de escalación y transiciona + notifica.
5. **Alertas manuales:** endpoint para crear alerta manual (usuario con rol adecuado) sobre entidad/documento con fecha y destinatarios; mismo modelo, `origen = manual` (la generación en ingesta marca `origen = ingesta`, el barrido `origen = scheduler`).

### 2.4 Motor de notificación (Resend + in-app)

1. **Canal email — Resend:** cliente vía API HTTP de Resend (httpx con timeouts, per regla ED-0). Refactorizar `email.py` conservando la interfaz factory: si `RESEND_API_KEY` existe → Resend; fallback al SMTP actual si solo hay `SMTP_HOST`; si nada → canal deshabilitado con log claro (no excepción). Las invitaciones de onboarding migran al mismo cliente — un solo proveedor.
   - `EMAIL_FROM` por env. Nota: mientras el from sea `onboarding@resend.dev`, Resend solo entrega al email del dueño de la cuenta — suficiente para la verificación del sprint; el dominio propio es prerequisito de pilotos, no de este sprint.
2. **Canal in-app:** tabla Supabase `notificaciones` (usuario, tenant, tipo de evento, ref al evento, título/cuerpo renderizado, leída, timestamps). Endpoints: listar no leídas/todas paginado, marcar leída, marcar todas. (La campana UI es de ED-4; aquí solo backend.)
3. **Plantillas paramétricas** con `{variables}` interpoladas, por tipo de evento y por idioma del destinatario (usar la infraestructura i18n/tipo_segmento `mensaje_alerta` existente del doc 12 como referencia). **Todo mensaje de alerta pasa por `safety_validator.py` antes de enviarse** — la línea regulatoria (solo administrativo) se valida también en el mensaje final, no solo en la generación.
4. **Entrega y fallos:** envío asíncrono fuera del request path (job o cola ligera sobre Redis existente); reintento con backoff (3 intentos); fallo definitivo → evento FAT + notificación marcada `fallida` visible en el listado admin. Registro por envío exitoso: arista `[:NOTIFICADO_DE {timestamp, canal}]` + FAT.
5. **Cableado:** la creación de `:Alerta` (las tres rutas: ingesta, scheduler, manual) dispara notificación a los destinatarios resueltos por la `ReglaAlerta` aplicable. Las alertas dejan de ser mudas.

### 2.5 Directorio de Destinatarios

1. Tabla Supabase `destinatarios` por tenant: tipo (`proveedor_externo` | `departamento_interno` | `colaborador`), nombre, email (para externo), ref a usuario (colaborador), miembros (departamento → usuarios), categorías/etiquetas, activo.
2. CRUD admin (`/destinatarios`), scope multi-tenant estricto, solo rol admin.
3. Guardrail canónico: **el admin da de alta, el operador solo selecciona.** Ningún endpoint de envío acepta un email libre — solo `destinatario_id`.
4. `ReglaAlerta` referencia destinatarios de este directorio.

### 2.6 Conectar `admin/alertas/page.tsx`

Desmockear: `guardar()` llama a los endpoints reales de `ReglaAlerta` + Directorio; la página lee y persiste de verdad. **Solo lógica de datos** — cero cambios visuales (el porteo visual de esa vista pertenece al Mapa de Paridad §2.3; conectar datos no viola su ley). Si el markup actual del mock no tiene campos para algo del modelo (ej. escalación), exponer lo que el markup ya soporta y reportar el delta para §2.3 del Mapa — no diseñar UI nueva en código.

## 3. Fuera de alcance (no tocar)

- Solicitudes y todo el Pilar 3 (ED-2) — pero la base `eventos_dirigidos` se diseña para que ED-2 solo agregue, no refactorice.
- Superficies UI nuevas (campana, bandeja, formularios) — ED-4 / Mapa de Paridad.
- Canal push.
- Ramas del Mapa de Paridad (`fix/consulta-8-tipos-respuesta`).
- Siembra de demo-maxi (tarea separada ya emitida).

## 4. Tests automatizados (CI, sin servicios reales donde aplique)

1. Máquina de estados: transiciones válidas/inválidas, FAT por transición.
2. `evaluate_vencimientos`: crea alertas al cruzar threshold; idempotencia (segunda corrida = 0 duplicados); respeta `ReglaAlerta` por tenant.
3. Lock del scheduler: dos instancias, solo una ejecuta.
4. Notificación: creación de alerta → notificación in-app persistida + email invocado (cliente Resend mockeado); reintento y fallo definitivo marcado; `safety_validator` rechaza mensaje no-administrativo y el envío se bloquea.
5. Directorio: CRUD con scope de tenant; envío rechaza email libre (solo `destinatario_id`).
6. Acciones: cada una transiciona + registra FAT; `postponer` sin justificación = 422.
7. Compatibilidad: pipeline T7 y `AlertsDashboardPayload` siguen verdes.

## 5. Salida verificable

1. CI verde con la suite nueva.
2. En prod tras deploy: crear alerta manual → notificación in-app consultable por endpoint + **email real recibido** (a tu correo, vía `resend.dev` o dominio si ya existe) con plantilla correcta.
3. Corrida real de `evaluate_vencimientos` en prod (disparo manual del job) reportada: tenants procesados, alertas creadas, cero duplicados en segunda corrida.
4. `admin/alertas/page.tsx` persiste y relee reglas reales (verificable en preview de Vercel).
5. Inventario en el reporte: endpoints nuevos, tablas/nodos nuevos, migraciones aplicadas, y el delta de campos que §2.3 del Mapa deberá exponer.

## 6. Notas de integración para Opus

- Rama nueva desde `main` (`feat/ed1-alertas-eventos-dirigidos`). No tocar ramas del Mapa.
- Clientes de red nuevos (Resend) nacen con timeouts explícitos y envueltos según el patrón ED-0 (`run_blocking` donde aplique) — la regla "ningún cliente sin socket timeout" es permanente.
- Migraciones Supabase: numeración consecutiva (023+), actualizar `EXPECTED_TABLES` del script de verificación en el mismo PR.
- Secrets esperados en Fly: `RESEND_API_KEY`, `EMAIL_FROM`. Si al ejecutar no están configurados, construir todo igual (factory maneja ausencia), verificar email en test con mock, y reportar la verificación de email real como bloqueada por secret — único caso aceptable de verificación diferida en este sprint.
- Los defaults de `ReglaAlerta` al onboarding: integrarlos donde el onboarding ya crea artefactos por tenant, más backfill para tenants existentes.
- Reporte final único: inventario completo, resultado de CI, resultado del deploy, evidencia de la salida verificable punto por punto.
