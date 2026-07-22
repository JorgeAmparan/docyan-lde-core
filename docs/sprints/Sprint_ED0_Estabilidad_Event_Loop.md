# Sprint Contract ED-0 — Estabilidad: bloqueo del event loop en paths autenticados

XCID SA de CV — DOCYAN LDE™ — Julio 2026
Repo: `docyan-lde-core` · Referencia: `DOCYAN_Adenda_Eventos_Dirigidos.md` §6 · Incidente: Tarea #11

**Modo de operación:** UNA aprobación (este contrato) + ejecución completa + UN reporte final. Sin iteración multi-fase. Verdad operacional sobre proyección optimista. CI es la autoridad (no correr build/test local si el I/O del entorno se cuelga — per política del repo).

---

## 1. Contexto y causa raíz (verificada por auditoría, no hipótesis)

Incidente de producción: ambas máquinas de Fly (`docyan-lde-api`) cayeron con health check en crítico tras una sola consulta real ("context deadline exceeded" incluso en `/health`). Mitigado con reinicio manual. Causa raíz identificada en código:

1. **Llamada síncrona bloqueante dentro del event loop:** `consultar` (`mo.py:263-285`) es `async def` pero llama directo a `mo.handle_request`, que es `def` síncrono (`master_orchestrator.py:100`). Igual en `chat_ask`. Una llamada externa estancada (LLM, embedder, FalkorDB) bloquea el loop completo de uvicorn.
2. **Sin socket timeout en FalkorDB:** `DKGClient` crea `FalkorDB(host, port)` sin `socket_timeout` (`dkg_client.py:82`). El timeout que se pasa a `graph.query` es server-side; si el TCP se estanca, el `recv` bloqueante nunca retorna.
3. **Consecuencia:** el probe de Fly (`fly.api.toml:33-42`, cada 15s, timeout 5s) no recibe respuesta de `/health` (que es trivial y no toca DB — `api/main.py:105-107`), el check falla y Fly reinicia la máquina.

**El patrón correcto ya existe en el repo:** `demo.py:159-166` protege con `asyncio.wait_for(asyncio.to_thread(...), timeout=9s)`. Los paths autenticados nunca recibieron ese arreglo. Este sprint lo generaliza.

## 2. Prerequisitos

Ninguno. Este sprint es inmediato y bloquea la confiabilidad de cualquier demo. No depende del Mapa de Paridad (no toca superficies frontend) ni de ED-1/ED-2.

## 3. Alcance

### 3.1 Descarga a thread + timeout en todos los paths autenticados

- Inventariar **todos** los endpoints `async def` que llamen código síncrono de pipeline (mínimo conocido: `consultar` en `mo.py:263-285` y `chat_ask`; verificar si hay otros — p. ej. ingesta síncrona, endpoints de grafo, exportaciones).
- Envolver cada uno con el patrón de `demo.py`: `asyncio.wait_for(asyncio.to_thread(fn, ...), timeout=TIMEOUT)`.
- `TIMEOUT` configurable por variable de entorno (`QUERY_TIMEOUT_SECONDS`), con default coherente para paths autenticados. El demo usa 9s; los paths autenticados pueden requerir más por consultas complejas — fijar default 30s, documentar en `.env.example`. El demo conserva su 9s.
- Al expirar: respuesta HTTP 504 con cuerpo JSON claro (`{"error": "timeout_consulta", ...}`), registro FAT del timeout, y **sin dejar el thread huérfano escribiendo a medias**: verificar que las escrituras del pipeline (FAT en Supabase, sesión en Redis) sean seguras ante cancelación o queden en estado consistente detectable.

### 3.2 Timeouts de socket en clientes externos

- `DKGClient` (`dkg_client.py:82`): agregar `socket_timeout` y `socket_connect_timeout` a la construcción de `FalkorDB(...)`, configurables por env (`FALKORDB_SOCKET_TIMEOUT`, default razonable ≤ al timeout del endpoint), aplicado en todos los puntos donde se construya el cliente.
- **Cliente Redis** (sesiones MO, scheduler): verificar y agregar `socket_timeout`/`socket_connect_timeout` si faltan.
- **Cliente HTTP del embedder BGE-M3** y **llamadas LLM** (LiteLLM/httpx): verificar que toda llamada tenga timeout explícito de conexión y lectura; agregar donde falte. Considerar el cold-start del embedder (~5 min con máquinas auto-stopped): el timeout de conexión al embedder debe distinguir "arrancando" de "colgado" — timeout de conexión corto con reintentos espaciados es aceptable; documentar el valor elegido y su razón en el reporte.
- Regla general: **ningún cliente de red sin timeout de socket en todo `app/`.** El inventario completo (cliente → archivo:línea → timeout aplicado) va en el reporte.

### 3.3 Test de regresión del incidente

- Test de integración que simule una llamada colgada (monkeypatch de `handle_request` o del cliente FalkorDB con `time.sleep` largo) y verifique: (a) el endpoint devuelve 504 al expirar el timeout, y (b) **`/health` responde < 1s durante el cuelgue** (petición concurrente). Este test es la prueba de que el incidente no puede repetirse.
- Test unitario de que `DKGClient` construye con socket timeouts desde env.
- Tests existentes del pipeline de consulta deben seguir verdes (el cambio a `to_thread` no altera contratos de respuesta).

### 3.4 Post-mortem

- Crear `docs/postmortems/2026-07_event_loop_bloqueado.md`: síntoma, línea de tiempo conocida, causa raíz (con rutas de código), fix aplicado, prevención (el test de regresión). Breve — una página. Hoy no existe ningún post-mortem en el repo; este es el primero y fija el formato.

## 4. Fuera de alcance (no tocar)

- Arranque del scheduler, alertas, solicitudes (ED-1/ED-2).
- Cualquier superficie frontend (Mapa de Paridad en curso, rama `fix/consulta-8-tipos-respuesta`).
- Refactor del `master_orchestrator` a async nativo — ese es un cambio mayor no requerido; `to_thread` es el fix correcto y suficiente ahora.
- Ajustes al probe de Fly (`fly.api.toml`): el probe está bien; el problema era el loop.

## 5. Tests automatizados requeridos

Los de §3.3, corriendo en CI (GitHub Actions). Política balanceada: esto es 100% backend. CI verde antes de mergear.

## 6. Salida verificable

1. Una consulta autenticada artificialmente colgada devuelve 504 en `QUERY_TIMEOUT_SECONDS` y `/health` responde durante todo el cuelgue (test de regresión verde en CI).
2. Inventario en el reporte: todos los endpoints protegidos + todos los clientes de red con sus timeouts (archivo:línea).
3. Post-mortem en `docs/postmortems/`.
4. Deploy a producción en Fly (`docyan-lde-api`) verificado: una consulta real completa de punta a punta con cita, y `/health` estable.

## 7. Notas de integración para Opus

- Rama nueva desde `main` (p. ej. `fix/ed0-event-loop-timeouts`). No trabajar sobre `fix/consulta-8-tipos-respuesta`.
- Respetar el patrón de `demo.py:159-166` como referencia canónica — no inventar un mecanismo distinto.
- `handle_request` es síncrono y se queda síncrono; solo cambia cómo se invoca desde los endpoints.
- Si al inventariar aparecen endpoints síncronos bloqueantes adicionales no listados aquí, se protegen igual en este mismo sprint — no se difieren ni se reportan como pendiente. La única razón válida para no proteger algo es una dependencia técnica real, documentada en el reporte.
- Reporte final único: qué se protegió, inventario de timeouts, resultado de CI, resultado del deploy, y el post-mortem enlazado.
