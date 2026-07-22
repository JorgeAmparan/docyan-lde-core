# Post-mortem — Event loop bloqueado por consulta autenticada (Julio 2026)

**Producto:** DOCYAN LDE™ by XCID · **Servicio:** `docyan-lde-api` (Fly.io)
**Severidad:** crítica (caída total de la API) · **Estado:** resuelto (Sprint ED-0)
**Autor:** Opus 4.8 · **Primer post-mortem del repo** (fija el formato).

> Formato: síntoma → línea de tiempo → causa raíz (con rutas de código) → fix →
> prevención. Una página. Sin ambigüedad: lo que se verificó, se afirma; lo que
> no, se dice.

---

## 1. Síntoma

Ambas máquinas de Fly de `docyan-lde-api` cayeron con el health check en estado
crítico tras **una sola consulta real**. En los logs, `context deadline exceeded`
aparecía incluso sobre `/health` — un endpoint trivial que no toca base de datos.
Mitigado con reinicio manual de las máquinas. El patrón (una consulta tumba todo,
`/health` deja de responder) apuntaba a bloqueo del event loop, no a un fallo de
dependencia aislado.

## 2. Línea de tiempo (conocida)

- **T0** — llega una consulta autenticada (`POST /mo/query`). Una llamada externa
  del pipeline (LLM vía LiteLLM/genai, embedder BGE-M3, o FalkorDB) se estanca a
  nivel de socket TCP sin retornar.
- **T0 + segundos** — el handler `async def consultar` había llamado de forma
  **síncrona** a `mo.handle_request` (código `def`), así que el `recv` bloqueante
  del socket estancado congeló el ÚNICO event loop de uvicorn.
- **T0 + 15s** — el probe de Fly (`fly.api.toml`, cada 15s, timeout 5s) hace
  `GET /health`. Con el loop congelado, `/health` (trivial, sin DB) no se atiende.
- **Repetido** — el check falla de forma sostenida en ambas máquinas → Fly las
  reinicia. Servicio caído hasta el reinicio manual.

## 3. Causa raíz (con rutas de código)

Dos defectos que se componen:

1. **Llamada síncrona bloqueante dentro del event loop.** `consultar`
   (`app/api/routers/mo.py`) y `chat_ask` (`app/api/routers/chat.py`) eran
   `async def` pero invocaban directo código síncrono de pipeline
   (`MasterOrchestrator.handle_request`, `ResponseIntelligence.responder`). Una
   llamada externa estancada dentro de ese código bloquea el loop completo — no
   solo la petición en curso, sino **toda** la app, incluido `/health`.

2. **Clientes de red sin socket timeout.** `DKGClient` construía
   `FalkorDB(host, port)` (`app/graph/dkg_client.py`) sin `socket_timeout`/
   `socket_connect_timeout`. El `timeout` de `graph.query` es server-side: si el
   TCP se estanca, el `recv` del cliente nunca retorna. Igual en los clientes
   Redis (`redis_client.py`, `session_manager.py`, `dispatcher.py`) y en las
   llamadas LLM (genai/LiteLLM), todos sin timeout de red explícito.

El probe de Fly y su configuración **no eran el problema** — el probe está bien;
el problema era el loop congelado que impedía responderlo.

## 4. Fix aplicado (Sprint ED-0)

- **Descarga a thread + corte duro.** Se generalizó el patrón que ya existía en
  el repo (`app/api/routers/demo.py:159-166`, `asyncio.wait_for(asyncio.to_thread
  (...), timeout)`) a un helper canónico `app/api/blocking.py::run_blocking`.
  **Todos** los endpoints autenticados que llaman código síncrono de pipeline lo
  usan (mo, chat, search, admin, qr, ingesta, onboarding, platform, invitations,
  recursos, observations, governance, trail, mis-documentos, documents, billing,
  demo, y la verificación de API-Key en `auth.py`). Al expirar → **HTTP 504** con
  cuerpo `{"error": "timeout_consulta", ...}`, registro FAT desacoplado del
  timeout, y el loop queda libre para `/health`.

- **Socket timeouts en todo cliente de red** (§3.2): FalkorDB
  (`FALKORDB_SOCKET_TIMEOUT`/`_CONNECT`), Redis (`REDIS_SOCKET_TIMEOUT`/`_CONNECT`
  en los 3 clientes), BGE-M3 (connect separado del read para tolerar cold-start),
  y timeout explícito en las llamadas LLM (`LLM_TIMEOUT_SECONDS`, genai/LiteLLM).

- `handle_request` **sigue siendo síncrono** — solo cambió cómo se invoca. No se
  refactorizó el MO a async nativo (fuera de alcance; `to_thread` es suficiente).

**Nota sobre la cancelación:** `wait_for` cancela la espera, no el thread (Python
no interrumpe threads). El thread huérfano vive hasta que su socket expira — por
eso los socket timeouts de §3.2 son necesarios, no opcionales. Las escrituras del
pipeline son discretas e idempotentes (append al FAT, `setex` de sesión), así que
un thread que termina tras el 504 deja estado consistente, no a medias.

## 5. Prevención

- **Test de regresión** (`tests/test_ed0_event_loop.py`,
  `test_consulta_colgada_devuelve_504_y_health_responde`): una `/mo/query`
  artificialmente colgada devuelve 504 al expirar el timeout, y `/health`
  responde en **< 1s DURANTE el cuelgue** (petición concurrente). Es la prueba
  ejecutable de que el incidente no puede repetirse. Corre en CI sin FalkorDB/
  Redis reales (usa dobles).
- Tests de que `DKGClient` construye el cliente FalkorDB con socket timeouts.
- **Regla operativa:** ningún endpoint `async def` debe llamar código de red/
  pipeline síncrono sin `run_blocking`; ningún cliente de red en `app/` sin
  timeout de socket.

## 6. Alcance no cubierto (deuda consciente)

- Supabase (`postgrest`/httpx interno) no expone un socket timeout que se pueda
  configurar de forma trivial desde aquí; sus endpoints quedan protegidos por el
  corte duro de `run_blocking` (504 + loop libre), no por un socket timeout propio.
- Refactor del MO a async nativo: no requerido; `to_thread` es el fix correcto y
  suficiente ahora.
