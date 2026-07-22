# DOCYAN LDE™ — Adenda: Subsistema de Eventos Dirigidos
## Alertas + Solicitudes sobre base común

XCID SA de CV — DOCYAN LDE™ by XCID — Julio 2026

> **Rango normativo.** Esta adenda formaliza los Pilares 2 (Alertas) y 3 (Data accionable / Solicitudes) de la propuesta de valor. Rige sobre los docs 01, 03, 04 y 14 donde haya conflicto, y se apoya en la auditoría de estado de julio 2026 sobre `docyan-lde-core` (estado verificado en código, no proyectado). No reabre decisiones del Paso C ni de la Adenda Post-PoC.

---

## 0. Propuesta de valor que esta adenda materializa

La consulta deja de terminar en la respuesta. Cada respuesta con provenance produce un **dato verificado** que puede disparar acción dirigida:

1. **Consulta** (Pilar 1) — despliegue FLOW, render por tipo de intención, cita con span. *Ya construido; esta adenda solo le cierra el pedigree end-to-end (§8).*
2. **Alertas** (Pilar 2) — eventos dirigidos **disparados por el sistema**: fechas accionables clasificadas semánticamente en la ingesta y/o reglas configuradas, notificadas por correo e in-app.
3. **Solicitudes** (Pilar 3) — eventos dirigidos **disparados por el usuario**: sobre un dato de la respuesta que representa una necesidad, botón + formulario tipado ruteado a un destinatario configurable (proveedor externo, departamento interno, colaborador).

Esto inserta a DOCYAN operativamente entre el descubrimiento de información y la solicitud de compra/servicio. La solicitud persistida crea, además, la capa emergente de inteligencia de demanda (Nivel 3): captura de datos desde MVP, visualización de reportes post-MVP.

---

## 1. Base común: `:EventoDirigido`

Alertas y solicitudes son **un solo subsistema** con dos disparadores. Construirlos por separado es deuda arquitectónica prohibida.

### 1.1 Abstracción

Todo evento dirigido comparte:

| Aspecto | Definición común |
|---|---|
| Origen | Referencia con provenance al dato que lo motiva (nodo del grafo + span de caracteres + documento) |
| Destinatarios | Resueltos vía Directorio de Destinatarios del tenant (§5) |
| Ciclo de vida | `creado → notificado → leído → reconocido → en_proceso → resuelto \| escalado \| cancelado` |
| Notificación | Motor único (§4): Resend (email) + in-app. Push = extensión futura del mismo motor, no rediseño |
| Auditoría | Cada transición de estado registra evento FAT (familia 6 existente se extiende a familia "eventos dirigidos") |
| Traducción | Mensajes vía plantillas paramétricas con interpolación, en idioma del destinatario |

### 1.2 Especializaciones

| | `:Alerta` (existente, se completa) | `:Solicitud` (nueva) |
|---|---|---|
| Disparador | Sistema (scheduler / cierre de ingesta) | Usuario (botón en la respuesta de consulta) |
| Contenido | Vencimiento, faltante, fecha de calibración, documento por expirar | Cotización, servicio, mantenimiento, revisión, tarea |
| Regla regulatoria | **Solo administrativa. Nunca sugiere decisión clínica u operativa** (línea absoluta, Adenda Post-PoC §9) | El sistema **nunca sugiere solicitar**; muestra el botón, el humano decide. *Frecuencia-sí / causa-no* |
| Destinatario | Responsables por `ReglaAlerta` | Destinatario elegido por el usuario del Directorio |

**Implementación:** no se requiere un label `:EventoDirigido` físico en el grafo; la base común se implementa como módulo compartido en backend (`app/eventos_dirigidos/`) del cual `alerts/` y `solicitudes/` consumen ciclo de vida, notificación, ruteo y registro FAT. Los módulos hoy independientes (`eventos/`, `alerts/`, `notifications/`) se reconcilian bajo esta base — no se duplica una cuarta ruta.

---

## 2. Pilar 2 — Alertas: cierre de lo incompleto

Estado auditado: las alertas se generan al cierre de ingesta (`alerts/generador.py`, horizonte 90 días) y se sirven vía pipeline Tipo 7. Pero son **pull-only y mudas**. Esta adenda ordena completar:

### 2.1 Scheduler arrancado en producción
- `DocyanScheduler` se instancia en el **lifespan** de la app FastAPI (hoy solo existe en tests/scripts). APScheduler + RedisJobStore ya construidos; solo falta el arranque.
- `evaluate_vencimientos` deja de ser stub: barrido real diario sobre `:CertificadoVigencia`, procedimientos con `frecuencia_esperada` y observaciones abiertas con plazo, conforme al pipeline proactivo del doc 03 (Tipo 7).
- Idempotencia: no crear alerta duplicada para el mismo threshold ya alertado.

### 2.2 `ReglaAlerta` viva
- Hoy es label muerto (declarado, jamás escrito/leído). Se persiste con: thresholds de días, nivel de urgencia por threshold, destinatarios (referencias al Directorio §5), canales, regla de escalación (N días sin reconocimiento → responsable superior).
- Defaults por tenant al onboarding; editables por el admin.

### 2.3 `AccionSobreAlerta` existente
- Hoy inexistente (solo un docstring). Se construye: `reconocer | iniciar_proceso | escalar | postponer (con justificación) | suprimir | resolver | comentar` — exactamente los tipos del doc 01. Cada acción = transición del ciclo de vida común + evento FAT.
- Los botones del `<AlertsDashboard />` (doc 04) dejan de ser decorativos: cada uno llama su endpoint.

### 2.4 Alertas configuradas por el usuario
- Además de las inferidas en ingesta, el usuario (según rol) puede crear alertas manuales sobre una entidad/documento con fecha y destinatarios. Mismo modelo `:Alerta`, `origen = manual`.

---

## 3. Pilar 3 — Solicitudes: construcción desde cero

Estado auditado: **cero hits** de "solicitud" en backend, frontend y migraciones. Todo lo siguiente es construcción nueva.

### 3.1 Modelo `:Solicitud`

| Propiedad | Tipo | Notas |
|---|---|---|
| `solicitud_id` | UUID | |
| `tipo_id` | FK → `:TipoSolicitud` | **Catálogo por tenant, no enum de código** (§3.1.1). Semilla base: `cotizacion \| servicio \| mantenimiento \| revision \| tarea` |
| `etiqueta_libre` | string opcional | Solo cuando el usuario eligió "Otra"; insumo de la taxonomía emergente (§3.1.1) |
| `estado` | enum | Ciclo de vida común §1.1 |
| `dato_origen` | ref | Nodo del grafo + `documento_id` + `span_inicio/fin` + fragmento verbatim. **La solicitud hereda el provenance de la consulta que la originó** |
| `consulta_id` | ref | Sesión/consulta FAT que la disparó |
| `solicitante_id` | FK usuario | |
| `destinatario_id` | FK Directorio §5 | |
| `mensaje` | texto | Campo libre del formulario |
| `campos_tipados` | JSON por tipo | Ej. cotización: cantidad, número de parte si el dato lo trae; servicio: fecha deseada |
| `entidad_id`, `codo_id`, `tenant_id` | FK | Scope multi-tenant estricto |
| `fecha_creacion`, `fecha_resolucion` | timestamp | |

#### 3.1.1 Tipado abierto con inferencia contextual

Los cinco tipos base son **ejemplos semilla, no un catálogo cerrado**. El diseño:

1. **Inferencia determinística del tipo sugerido.** El formulario abre con el tipo preseleccionado por mapeo de reglas: tipo de intención de la consulta + tipo de documento/entidad del dato de origen (catálogo de partes → cotización; evento de inspección sobre equipo → mantenimiento; documento de proveedor → servicio; contexto interdepartamental → tarea). No es el LLM recomendando: es mapeo determinístico, y el usuario cambia el tipo con un tap. *El sistema muestra, el humano decide.*
2. **`:TipoSolicitud` — catálogo por tenant.** Semilla de cinco al onboarding; el admin agrega los propios (ej. "verificación metrológica", "reabastecimiento"). Cada tipo define: nombre, campos tipados opcionales, tipos de destinatario sugeridos. El tipado nunca limita y la agregación de demanda permanece posible.
3. **Opción "Otra" + promoción.** Etiqueta libre capturada igual que un tipo formal. Cuando una etiqueta libre se repite en el tenant, el sistema la **propone al admin** para promoverla a `:TipoSolicitud` — taxonomía emergente del uso real, coherente con el EDB como almacén activo que propone. Propone el tipo, jamás la acción: *frecuencia-sí / causa-no*.

El campo de mensaje libre existe siempre, independiente del tipo.

Persistencia dual coherente con el patrón existente: nodo en FalkorDB (vinculado al grafo con `:DERIVA_DE` hacia el dato de origen) + registro operacional en Supabase para listados, ruteo y reporting. La tabla Supabase es la fuente para la capa de inteligencia de demanda.

### 3.2 Superficie en la consulta (UI)
- **Botón contextual "Solicitar"** en la respuesta cuando el dato representa una necesidad accionable (parte, servicio, calibración, revisión). La aparición del botón es determinística por tipo de dato/render — no es el LLM "recomendando"; es affordance, no sugerencia. Regla: **el sistema muestra el botón; el humano decide.**
- **Formulario simple:** tipo (inferido por contexto, cambiable, del catálogo del tenant + opción "Otra" con etiqueta libre — §3.1.1), destinatario (selector del Directorio), mensaje, campos tipados del tipo si los define. Prellenado con el dato de origen y su cita. Un envío = una solicitud.
- Fidelidad visual: el componente entra al Design System/prototipo **antes** de implementarse (la ley del Mapa de Paridad aplica: el prototipo manda). El diseño del botón + formulario + bandeja se agrega al prototipo como superficie nueva, luego se porta.

### 3.3 Ruteo y recepción
- **Destinatario interno** (usuario DOCYAN del tenant): notificación in-app + email; bandeja "Solicitudes recibidas" en su vista.
- **Destinatario externo sin cuenta DOCYAN** (proveedor no suscriptor): email vía Resend con el contenido de la solicitud, la cita de origen (fragmento, no el documento), datos de contacto del solicitante y branding DOCYAN. Sin acceso al tenant. Cada solicitud recibida es exposición pasiva del producto al proveedor.
- Respuesta del externo: por email directo al solicitante en MVP (reply-to = solicitante). Portal de respuesta para externos = post-MVP, documentado aquí para no perderse.
- Toda transición (enviada, leída si el canal lo permite, resuelta manualmente por el solicitante) registra FAT.

### 3.4 Inteligencia de demanda (captura desde MVP)
- Cada solicitud persiste: tipo, entidad, dato de origen, destinatario, tiempos de ciclo. Sin UI de reporting en MVP — la visualización (frecuencias por parte/servicio/proveedor) es post-MVP sobre datos ya capturados. *Frecuencia-sí / causa-no.*

---

## 4. Motor de notificación (único, compartido)

| Decisión | Valor |
|---|---|
| Email | **Resend** (decisión cerrada julio 2026). Sustituye el plan Brevo y absorbe también las invitaciones de onboarding — un solo proveedor. El `email.py` existente se refactoriza al cliente Resend manteniendo la interfaz factory |
| In-app | Centro de notificaciones por usuario (campana en OrgShell/ColabShell): no leídas, marcar leída, link al evento |
| Push | Extensión futura del mismo motor (interfaz de canal ya definida); no se construye en MVP, no se rediseña después |
| Registro | Arista `[:NOTIFICADO_DE {timestamp, canal}]` + evento FAT por envío |
| Plantillas | Paramétricas con `{variables}` preservadas (tipo_segmento `mensaje_alerta` del doc 12), en idioma del destinatario |
| Fallos | Reintento con backoff; fallo definitivo registra FAT y marca la notificación como fallida visible al admin |

La UI de destinatarios de alertas existente (`admin/alertas/page.tsx`, hoy mock con `toast.success`) se conecta a este backend — no se reconstruye.

---

## 5. Directorio de Destinatarios del tenant

Guardrail central del ruteo:

- **El admin da de alta destinatarios; el operador solo selecciona.** El operador nunca teclea un email libre. Razones: impedir uso del flujo para exfiltrar datos del tenant a direcciones arbitrarias; mantener el ruteo auditable; controlar la representación del tenant ante externos.
- Tipos de destinatario: `proveedor_externo` (nombre, email, empresa, categorías de servicio) | `departamento_interno` (resuelve a usuarios miembros) | `colaborador` (usuario del tenant).
- CRUD del admin en Vistas de Organización; los destinatarios alimentan tanto `ReglaAlerta` como el selector de solicitudes.
- Cualquier email externo es válido (proveedor no requiere ser suscriptor DOCYAN) — la apertura está en el alta del admin, no en el envío del operador.

---

## 6. Estabilidad — prerequisito absoluto (Tarea #11)

Causa raíz identificada por auditoría (más precisa que la hipótesis del Mapa de "threadpool sin timeout"): los paths autenticados (`mo.py consultar`, `chat_ask`) llaman **síncrono directo dentro del event loop** (`async def` → `mo.handle_request` `def` síncrono, sin `to_thread`), y `DKGClient` crea la conexión FalkorDB **sin `socket_timeout`**. Una llamada externa estancada bloquea el loop → `/health` no responde en 5s → Fly reinicia la máquina. El endpoint demo ya tiene el patrón correcto (`asyncio.wait_for(to_thread(...), timeout)`).

**Sprint ED-0 (primero, pequeño, antes de todo lo demás):**
1. Aplicar `asyncio.wait_for(asyncio.to_thread(...), timeout)` a todos los paths autenticados de consulta, con timeout configurable (default coherente con demo).
2. `socket_timeout` (y `socket_connect_timeout`) en `DKGClient`.
3. Timeouts explícitos en llamadas a LLM y embedder si carecen de ellos.
4. Test de regresión: consulta artificialmente colgada no debe tumbar `/health`.
5. Post-mortem breve en `docs/` (no existe hoy).

Sin ED-0 no hay demo confiable con pilotos: una consulta colgada tumba el producto completo.

---

## 7. Scheduler y clasificación de fechas — estado y cierre

- La clasificación semántica de fechas accionables en ingesta **ya existe** (schema `calibracion.py`: `FechaVencimiento`/`CertificadoCalibracion`, marcadas administrativas; `dkg_provenance.py` computa `:Alerta` al cierre de ingesta). No se reconstruye; se extiende a los demás schemas de la librería por tipo documental donde apliquen fechas (MSDS: vigencia de hoja; manual: revisión de documento; especificación: vigencia).
- El scheduler complementa (no reemplaza) la generación en ingesta: cubre el paso del tiempo sobre documentos ya ingeridos.

---

## 8. Cierre del pedigree: navegación al span en el documento

Decisión cerrada: **entra ahora**, no se difiere.

- Backend ya produce `span_inicio/fin/fragmento`; el frontend consume solo el verbatim para el overlay. Falta: "Abrir documento" salta a la posición del span en el visor del PDF (resaltado del fragmento).
- El drift de offsets del SDK documentado se maneja con estrategia de anclaje: posicionamiento por offset con verificación del fragmento verbatim en destino; si el fragmento no coincide en el offset, búsqueda del verbatim en la página citada como fallback, y si tampoco, el aviso honesto existente ("fragmento no disponible") — nunca resaltar texto equivocado.
- Esto cierra la promesa de Capa 3 (confianza): cita al span fuente *a un toque*, end-to-end.

---

## 9. Coordinación con el Mapa de Paridad

El Mapa de Paridad (porteo fiel del prototipo, superficie por superficie) sigue su curso sin interferencia. Reglas de convivencia:

1. **ED-0 (estabilidad) no espera al Mapa.** Es incidente de producción abierto, ajeno al porteo; se ejecuta ya.
2. **ED-1 y ED-2 backend corren en paralelo al Mapa.** No tocan superficies frontend; la ley "una superficie a la vez" aplica al porteo visual, no al backend.
3. **Las superficies UI de eventos dirigidos respetan la secuencia del Mapa:** primero se cierra el Mapa (§2.3, §2.7, barrido CSS, ColabShell, móvil); la cola "Consulta→Alerta→Solicitud" del propio Mapa ya las contempla después. Novedad de esta adenda: esas superficies se **diseñan primero en el prototipo** (extensión del Design System) mientras el backend se construye, para que al llegar su turno solo haya porteo fiel, no diseño improvisado en código.
4. La vista "Alertas administrativas" de §2.3 se porta como está en el prototipo; sus botones de acción quedan conectables a los endpoints de §2.3 de esta adenda cuando ED-1 esté mergeado (conectar datos no viola la ley del Mapa: la lógica de datos nunca fue parte del porteo).
5. El demo público consolidado a un solo CoDo mostrando el ciclo completo Consulta→Alerta→Solicitud permanece al final, dependiente de que ED-1/ED-2 existan de verdad — como el Mapa ya lo establece.

---

## 10. Secuencia de Sprint Contracts

| Sprint | Alcance | Prerequisito |
|---|---|---|
| **ED-0** | Estabilidad (§6). Fix bloqueo del event loop + socket timeouts + test de regresión + post-mortem | Ninguno. Inmediato |
| **ED-1** | Backend Pilar 2 completo: lifespan del scheduler, `evaluate_vencimientos` real, `ReglaAlerta` + `AccionSobreAlerta` persistentes, motor de notificación Resend + in-app, Directorio de Destinatarios, conexión de `admin/alertas/page.tsx` | ED-0 |
| **ED-2** | Backend Pilar 3 completo: módulo `eventos_dirigidos` común, modelo `:Solicitud` dual, endpoints, ruteo interno/externo, captura de inteligencia de demanda | ED-1 (comparte base común y motor) |
| **ED-3** | Pedigree end-to-end (§8): navegación al span en PDF con estrategia de anclaje | Ninguno respecto a ED-1/2; puede paralelo |
| **ED-4** | Superficies UI: diseño en prototipo (botón + formulario de solicitud, bandeja, centro de notificaciones) → porteo fiel | Diseño: paralelo a ED-1/2. Porteo: cierre del Mapa de Paridad |

Cada sprint: UNA aprobación + ejecución completa + UN reporte. Tests automatizados obligatorios. CI como puerta.

---

## 11. Línea regulatoria — reafirmación

- Alertas: **solo administrativas** (vencimientos, faltantes, fechas, documentos por expirar). Nunca decisión clínica u operativa. El `safety_validator.py` existente permanece como gate obligatorio de todo mensaje de alerta y se extiende a los mensajes de solicitud generados por plantilla.
- Solicitudes: el sistema nunca sugiere solicitar; presenta la affordance, el humano decide. Los reportes futuros de demanda muestran frecuencias, jamás causas ni recomendaciones. *DOCYAN cuenta, no concluye.*

---

*Fin de la Adenda de Eventos Dirigidos.*
