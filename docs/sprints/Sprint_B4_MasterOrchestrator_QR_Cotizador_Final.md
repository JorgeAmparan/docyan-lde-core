# Sprint Contract B4 — Master Orchestrator + Tokens QR + Cotizador integrado

**Producto:** DOCYAN LDE™ — Live Document Environment by XCID
**Bloque:** B4 (numeración postPoC) | **Ejecutor:** Opus 4.8 vía Claude Code CLI
**Modo:** Una aprobación + ejecución completa + un reporte final. Opus ejecuta
todo en su sesión (terminal, git, Supabase, Fly), sin pelota de regreso a Jorge.
**Rama:** `sprint/B4-master-orchestrator-qr` sobre `main` (commit `2b147df` con
B3.6 mergeado).

> **Nota.** Este contrato reemplaza al contrato anterior
> `Sprint_B4_MasterOrchestrator_QR_Cotizador.md` (escrito antes de B2/B2.1/B2.2
> y antes de la Adenda MVP). Cambios respecto al anterior: numeración actual
> (B4, no B3); cotizador **ya construido en B2**, B4 lo **integra**;
> referencias correctas a B7 (GRG completo) y B8 (clasificador completo);
> reconoce el estado real desplegado de Redis. Las **baselines de costo del
> PoC, el incidente del hard cap, y el detalle de rate limiting** del contrato
> anterior se conservan como referencia operativa.

---

## Alcance acotado por la Adenda MVP

La **Adenda de Alcance MVP de Consulta Viva**
(`docs/DOCYAN_Adenda_Alcance_MVP_ConsultaViva.md`) dice sobre B4:

> **B4 Master Orchestrator + Tokens QR + Cotizador integrado.** El QR
> escaneable que resuelve a contexto es el diferenciador físico de "consulta
> donde se necesita".

B4 es la espina dorsal del MVP de consulta viva. Sin MO, las piezas que ya
existen (worker, backend, grafo, DTM) funcionan aisladas, no como sistema
coordinado. Sin QR persistente, DOCYAN pierde su gancho físico de "consulta
donde se necesita". El cotizador YA está construido en B2 (`app/ingesta/
budget_manager.py` + helper de tiktoken) — B4 lo **integra** al flujo MO, no lo
reconstruye.

Este sprint construye el MO de negocio completo, no la fachada interna del
SDK (eso ya lo absorbió GraphRAG-SDK 1.1.1).

## Prerequisitos (ya cumplidos)

- B1 cerrado: DKG con schemas por tipo documental.
- B2 + B2.1 + B2.2 cerrados: worker de ingesta operativo, Redis desplegado
  (`docyan-lde-redis`), `REDIS_URL`/`REDIS_QUEUE_URL` inyectadas en el backend.
- B3 cerrado: DTM cimientos (schema + segregación + provisioning).
- B3.5 cerrado: deuda técnica B0–B3 atendida.
- B3.6 cerrado: extracción LLM-only verificada end-to-end (18 nodos / 19
  relaciones sobre PDF de referencia, costo ~$0.0157, 9.4k tokens).
- Cotizador pre-ingesta funcional (`app/ingesta/budget_manager.py`), smoke
  probado: rechaza por saldo, gate sin bypass.

## Contexto para Opus

El MO (Master Orchestrator) es la pieza central del MVP (doc 05): **fachada
del sistema hacia el exterior**. Todo request (API call, webhook WhatsApp,
escaneo de QR, acción de UI, tarea programada) termina invocando al MO. El
`DocyanOrchestrator` actual del repo (~129 LOC, coordinación CLI) NO es el MO
del plan — es código pre-modelado que se reemplaza con esta implementación.

**Severidad del cotizador (contexto histórico):** durante el PoC, el sistema
sin gate de cotización topó el hard cap de Google de MXN 119 en un solo
incidente. Por eso la Adenda 8 marca el cotizador como CRÍTICO: gate sin
bypass, saldo prepagado finito, sin auto-recharge.

Decisiones cerradas que el MO debe respetar:
- Decisión #3 Paso C: **APScheduler con backend Redis** (ya tienes Redis vivo).
- Decisión #6 Paso C: Sesiones MO en **Redis con TTL diferenciado** +
  spillover Supabase para sesiones completadas.
- Decisión #15 Paso C: criticidad por segmento obligatoria en onboarding (B13),
  delegable a opción automática.
- Adenda 8: cotizador pre-ingesta CRÍTICO, gate sin bypass.

## Componentes a construir

### 1. Master Orchestrator con las 10 responsabilidades del doc 05

`app/orchestrator/master_orchestrator.py` (reemplaza al `DocyanOrchestrator`
actual; absorbe `app/main.py` si éste tiene lógica de coordinación). Cubre las
10 responsabilidades del doc 05:

1. **Resolución de contexto del request:** identidad (JWT), tenant, par
   lingüístico (de la sesión o default del tenant), canal (PWA / WhatsApp /
   API), variante regional jerárquica (usuario > cliente > default > neutro),
   permisos (del JWT y del modelo de roles doc 09), sesión activa o nueva.
2. **Clasificación y ruteo del request:**
   - Consulta → clasificador de B8 (interfaz definida aquí, implementación
     completa en B8). Para B4 basta un router que detecte "consulta" vs
     "ingesta" vs "configuración" vs "evento programado" y enrute al
     componente correcto.
   - Producción (ingesta) → coordinador de pipeline (que invoca cotizador +
     worker).
   - Configuración → onboarding (B13).
   - Evento programado → scheduler interno.
3. **Coordinación de pipelines:** invoca worker de ingesta (vía cola Redis,
   con el cotizador como gate), DKG (fachada de B1), DTM (cliente de B3 si la
   consulta involucra par lingüístico), gobernanza (GRG, integración mínima
   aquí, extensión en B7), composición de respuesta, adaptador de canal, FAT
   (registro mínimo aquí, extensión en B7).
4. **Gestión de estado de sesiones:** crea, obtiene, actualiza, transfiere
   entre canales (WhatsApp ↔ PWA preservando estado), cierra.
5. **Aplicación de gobernanza centralizada (Governance Gate):** invoca GRG
   antes de servir cualquier output. Verifica permisos, confianza (score por
   segmento), criticidad, freno de alucinación si confianza < umbral.
   Integración mínima con el GRG actual del repo (~252 LOC); extensión
   completa en B7.
6. **Resolución de variante regional y localización:** aplica jerarquía
   (usuario > cliente > default > neutro). Si el segmento solicitado no
   existe en la variante, fallback automático según la jerarquía.
7. **Adaptación a canal:** salida rica para PWA (estructura, anotaciones,
   QR clickeables), salida degradada graceful para WhatsApp (texto plano
   estructurado, sin perder el contenido sustantivo).
8. **Ejecución del scheduler proactivo:** APScheduler como backend único de
   programación. Tareas por tenant (vencimientos, limpieza de sesiones,
   sincronización con conectores cuando se reactiven, reportes periódicos).
9. **Registro auditable en FAT:** cada request del MO genera al menos una
   entrada en `audit_trail` (módulo `app/core/matrix.py` ya activo con
   service_role). Eventos: request recibido, ruteo, decisión de Governance
   Gate, output servido, errores.
10. **Gestión de errores y degradación graceful:** retry con backoff, fallback
    vía MR (Model Router existente, 4 tiers) cuando aplica, degradación a
    canal menos rico si el principal falla, escalación a humano (revisor
    asignado al tenant) cuando el caso lo amerita, comunicación honesta —
    **nunca enmascarar una falla como éxito**.

### 2. Sub-componentes del MO

Doc 05 nombra 6 sub-componentes. Implementarlos como módulos del paquete
`app/orchestrator/`:

- `context_resolver.py` — responsabilidad 1.
- `intent_router.py` — responsabilidad 2 (interfaz al clasificador de B8;
  router mínimo en B4).
- `pipeline_coordinator.py` — responsabilidad 3.
- `session_manager.py` — responsabilidad 4 (Redis + spillover).
- `governance_gate.py` — responsabilidad 5 (integra con GRG existente).
- `scheduler.py` — responsabilidad 8 (APScheduler backend Redis).

Las responsabilidades 6 (variante regional), 7 (adaptador de canal), 9 (FAT),
10 (errores) son transversales — implementarlas como utilidades del paquete
(`localization.py`, `channel_adapter.py`, `audit_logger.py`, `error_handler.py`).

### 3. Session Manager con TTLs diferenciados (decisión #6)

`app/orchestrator/session_manager.py` con Redis backend.

TTLs exactos (sliding window):
- **Consulta operativa: 30 minutos.**
- **Troubleshooting: 2 horas.**
- **Revisión: 8 horas.**
- **Onboarding: 30 días.**

Operaciones:
- `create_session(tenant_id, user_id, session_type, canal, ...) → session_id`
- `get_session(session_id) → SessionState | None`
- `update_session(session_id, partial_state)` (refresca TTL sliding)
- `transfer_session(session_id, new_canal)` (preserva estado, cambia canal)
- `close_session(session_id)` (spillover a Supabase en tabla
  `sessions_completed` para análisis y FAT histórico)
- Limpieza automática de expiradas vía tarea programada del scheduler (cada
  hora).

Migración Supabase si hace falta: tabla `sessions_completed` con campos
mínimos (id, tenant_id, user_id, session_type, canal, started_at, closed_at,
state JSONB, closed_reason).

Reutilizar la conexión Redis existente (`app/cache/redis_client.py` u homólogo)
si ya tiene una; no recrear.

### 4. APScheduler backend Redis (decisión #3)

`app/orchestrator/scheduler.py` con APScheduler configurado para usar Redis
como JobStore. **Único punto de programación temporal del sistema** — ningún
componente debe usar `cron` directo, threads sleep, ni `time.sleep` en loops.

Tareas iniciales (configurables por tenant):
- Evaluación de vencimientos administrativos (Tipo 7 del catálogo de
  intenciones): diario por default, cada 6 horas para tenants con alertas
  críticas marcadas.
- Limpieza de sesiones expiradas: cada hora.
- Mantenimiento de índices vectoriales del DKG: semanal (placeholder; la
  lógica completa puede ser stub aquí si depende de B14 hardening).
- Reportes periódicos a PMs: semanal (interfaz, contenido en B13).
- Evaluación de patrones del EDB para Nivel 3 visible: diaria (interfaz;
  contenido completo en B8).

El scheduler corre en el backend `docyan-lde-api`, no en el worker.

### 5. Governance Gate (integración mínima, extensión en B7)

`app/orchestrator/governance_gate.py` invoca el GRG existente (~252 LOC en
`app/core/grg.py`) antes de servir cualquier output. En B4:

- Verifica permisos del rol (modelo de roles doc 09 + service_role ya
  configurado).
- Lee `score_confianza` del output del pipeline. Si está bajo el umbral del
  tenant → no sirve, frena alucinación, registra en FAT, opcionalmente
  escalación a revisor según criticidad del segmento.
- Aplica criticidad (decisión #15): si el segmento es crítico y la confianza
  es media, requiere revisión humana antes de servir.

La **extensión completa de GRG** (reglas declarativas por tenant, librería
de policies, reglas F1–F10 del doc 07) va en B7.

### 6. Tokens QR persistentes

`app/qr/qr_generator.py` y `app/qr/qr_resolver.py`.

- **Generación:** vinculada a una `:EntidadOperativa` del DKG. El token
  contiene `tenant_id` + `entidad_id` + nonce, firmado con HMAC-SHA256 usando
  un secret de la app. El QR codifica una URL pública:
  `https://docyan-lde-api.fly.dev/qr/<token>`.
- **Resolución:** endpoint público `GET /qr/<token>` (sin JWT requerido para
  resolver — el QR mismo es la credencial; lo que se sirve detrás respeta
  permisos del tenant). Decodifica el token, valida la firma, verifica que
  el `tenant_id` coincide, recupera la entidad y los documentos asociados, y
  redirige al usuario al frontend con el contexto cargado.
- **Persistencia:** los QR son persistentes (no expiran por default; el
  modelo permite expiración si el tenant la configura).
- **Multi-tenant absoluto:** un QR de un tenant **no resuelve** entidades de
  otro tenant. Si se intenta, falla con 404 (no 403, para no filtrar
  existencia).

Tabla Supabase para registro: `qr_tokens` con campos (id, tenant_id,
entidad_id_dkg, created_at, created_by, expires_at NULL, revoked_at NULL,
nonce).

QR vincula a entidades del grafo de B1; usar fachada `docyan_graph.py`.

### 7. Integración del cotizador al flujo MO

El cotizador YA está en `app/ingesta/budget_manager.py` y se invoca hoy
directamente desde el endpoint de ingesta. B4 lo **integra al
`pipeline_coordinator`** del MO:

- Cualquier request de ingesta que llegue al MO pasa por el cotizador antes
  de encolar.
- El cotizador estima costo + tiempo. **Baselines de referencia del PoC:**
  NOM 32 páginas ~$0.036, Ley 61 páginas ~$0.046, corpus de 50 normas + 10
  leyes ~$2.26. Validación end-to-end de B3.6: PDF IB-111-RDA → ~$0.0157,
  ~9.4k tokens, 18 nodos / 19 relaciones.
- Contempla **tiempo además de costo** (Adenda 8). Gemini Flash 2.5: ~642s
  para documentos representativos del corpus. En ingestas multi-doc, rate
  limiting puede causar ~1,500 retries — el cotizador debe estimar tiempo
  realista para no decepcionar al usuario.
- Si el saldo del tenant es insuficiente → MO devuelve respuesta de rechazo
  con cifras claras, registra en FAT, no encola.
- Si saldo es suficiente → cotización aprobada, devuelve a usuario para
  confirmación explícita (gate sin bypass). Solo tras confirmación, MO
  encola el job.
- El cotizador-pre-ingesta de B4 es **distinto** del cotizador pre-venta de
  traducción (B11, diferido en Adenda). No confundir.

## Tests automatizados requeridos

Política balanceada cerrada en Paso C #14 (60-70% backend en este sprint, sin
frontend más que mínimo). Cobertura mínima 80% sobre módulos nuevos.

- **MO orquesta sesión completa con transición de canal:** sesión iniciada
  vía PWA, transferida a WhatsApp, estado preservado, cerrada.
- **Session Manager TTLs exactos:** 30 min consulta, 2 h troubleshooting, 8 h
  revisión, 30 d onboarding. Sliding window verificado (cada update refresca
  TTL).
- **Session Manager spillover:** sesión completada se mueve a Supabase tabla
  `sessions_completed` con estado final.
- **Scheduler:** tarea programada ejecuta en tiempo simulado (mock de tiempo);
  limpieza de sesiones expiradas elimina las que pasaron TTL.
- **Governance Gate:** output con `score_confianza < umbral` bloqueado;
  output limpio servido. Permisos: rol sin acceso a tenant → bloqueado.
- **QR roundtrip:** generación → URL → resolución → entidad correcta. Validación
  de firma. Rechazo de QR de otro tenant (404).
- **QR revocación:** marcar `revoked_at` → resolución falla.
- **Cotizador integrado al MO:** ingesta de prueba con saldo suficiente →
  cotización aprobada → confirmación → encolado en Redis. Saldo insuficiente
  → rechazo con cifras claras, no encolado. Estimación de tiempo incluida en
  la respuesta.
- **Cotizador con baselines del PoC:** documento de tamaño similar a NOM
  32pp produce estimación en el orden de ~$0.036; verificar tolerancia
  razonable (±30%).
- **Channel adapter:** mismo output del MO sale en formato PWA rico vs
  WhatsApp degradado. Sustancia preservada.
- **FAT logging:** cada request del MO deja al menos una entrada en
  `audit_trail` con tenant correcto.

## Salida verificable (todas obligatorias antes de cerrar)

- ✅ `app/orchestrator/` con master_orchestrator, context_resolver,
  intent_router, pipeline_coordinator, session_manager, governance_gate,
  scheduler, localization, channel_adapter, audit_logger, error_handler.
- ✅ `app/qr/qr_generator.py` y `app/qr/qr_resolver.py`.
- ✅ Endpoint `GET /qr/<token>` registrado en la API y respondiendo en Fly.
- ✅ Migraciones Supabase aplicadas (`sessions_completed`, `qr_tokens`).
- ✅ Smoke test end-to-end contra Fly:
   - Genera QR para una entidad ficticia, escanea la URL, resuelve con
     contexto correcto.
   - Crea sesión, transfiere de canal, cierra; verifica spillover.
   - Pide ingesta vía MO con saldo suficiente → confirmación → encolado;
     pide con saldo insuficiente → rechazo limpio (cifras + tiempo).
   - Una tarea del scheduler se ejecuta y deja huella en logs/FAT.
- ✅ Suite verde (los nuevos + todos los anteriores).
- ✅ CI verde en los 4 jobs sobre `sprint/B4-master-orchestrator-qr`.
- ✅ Merge a `main` con CI verde.
- ✅ Reporte final único.

## Lo que NO se construye (alcance declarado, no diferido oculto)

- **Clasificador de Intención completo + Pipelines Tipos 1-8:** B8. B4 deja
  un router mínimo que detecta "consulta" vs "ingesta" vs "configuración"
  vs "evento programado".
- **GRG completo (reglas declarativas F1–F10, librería de policies):** B7.
  B4 deja el Governance Gate enchufado al GRG existente del repo.
- **FAT extendido (cadena criptográfica SHA-256 visible al usuario, pedigree
  clickeable en UI):** B7. B4 deja logging al `audit_trail` ya activo.
- **UI PWA consumiendo MO:** B9. B4 deja los endpoints listos.
- **WhatsApp BSP integrado:** B10. B4 deja el adaptador de canal modelado.
- **Onboarding completo:** B13. B4 deja la interfaz que onboarding consumirá.

## Reglas de ejecución

- No stubs, no mocks (excepto en tests), no hardcoded de valores que deban
  venir de configuración. Alcance completo dentro del scope acotado.
- Verdad operacional. Si algo del modelado en docs no se puede implementar
  tal cual por una restricción real (de Redis, de APScheduler, de FalkorDB,
  del SDK), no inventar. Documentar el ajuste y la razón.
- **No dejar "no bloqueantes":** si destapas un bug, arréglalo en el sprint.
  Si no puedes arreglarlo sin desbordar alcance, repórtalo como **bloqueador
  explícito** al final, no como diferimiento difuso.
- Sin pelota de regreso a Jorge para confirmaciones intermedias.
- Tienes acceso a `.env` local, a Fly autenticado, a Supabase, a git y a
  GitHub. Ejecuta hasta cierre.

## Reporte final (un solo reporte)

Incluir:
- Cambios por módulo, con líneas de código aproximadas.
- Resultado de cada smoke test end-to-end (QR, sesión + transferencia, MO +
  cotizador, scheduler).
- Confirmación de FAT logging (algunas entradas de muestra).
- Migraciones aplicadas y verificadas.
- Estado de CI y merge a main.
- Decisiones de criterio tomadas y por qué.
- Cualquier bloqueador real al final (no diferimiento difuso).

Commit sugerido: `feat(B4): Master Orchestrator + Tokens QR + cotizador integrado al flujo MO`.
Push a `sprint/B4-master-orchestrator-qr`. Merge a `main` cuando CI verde.

---

## Notas para Opus

- Repo: `docyan-lde-core`. Rama base: `main` (commit `2b147df`).
- Reutilizar:
  - `app/core/matrix.py` (FAT existente, service_role activo) — el MO loggea
    aquí, no inventa otra tabla.
  - `app/core/grg.py` (~252 LOC existente) — el Governance Gate invoca lo que
    ya hay.
  - `app/core/edb.py` (Entity Data Brain) — el MO puede consultar patrones
    del EDB para tareas programadas (Nivel 3 visible).
  - Model Router (`app/core/mr.py` o equivalente, ~135 LOC, 4 tiers) — el MO
    lo invoca para fallback (responsabilidad 10).
  - Fachada de FalkorDB de B1 (`docyan_graph.py`) — para resolver entidades
    del QR.
  - Cliente DTM de B3 (`app/graph/dtm_client.py`) — disponible si el MO
    necesita resolver pares lingüísticos.
  - Cotizador de B2 (`app/ingesta/budget_manager.py`) — el MO lo invoca, no
    lo reconstruye.
  - Redis ya desplegado (`docyan-lde-redis`) con `REDIS_URL`/`REDIS_QUEUE_URL`
    inyectadas.
- El `DocyanOrchestrator` actual del repo (~129 LOC, CLI) se elimina o se
  conserva solo si todavía es útil para algún script — pero NO es el MO.
- El frontend NO se toca en este sprint (lo del MO se ejercita por API y
  smoke tests; B9 conecta UI PWA).
- Sin exposición de secrets en el reporte.

## Referencias

- **Adenda MVP:** `docs/DOCYAN_Adenda_Alcance_MVP_ConsultaViva.md`.
- **Doc 05:** MO con 10 responsabilidades y 6 sub-componentes.
- **Doc 14:** TTLs exactos por tipo de sesión.
- **Doc 09:** multi-tenancy y roles.
- **Adenda 2** (extracción) **y Adenda 8** (cotizador CRÍTICO).
- **Reporte B3.6:** baselines de costo y latencia post-validación end-to-end.
