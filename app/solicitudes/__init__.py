"""
Pilar 3 — Solicitudes (ED-2): data accionable sobre la base de Eventos Dirigidos.

DOCYAN LDE™ by XCID.

Una `:Solicitud` es un evento dirigido **disparado por el usuario**: sobre un dato
de la respuesta de consulta que representa una necesidad, el operador abre un
formulario tipado y lo rutea a un destinatario del Directorio. Comparte con las
alertas (ED-1) TODA la base común y **no la duplica**:

- ciclo de vida        → `app.eventos_dirigidos.ciclo_vida` (misma máquina de estados)
- motor de notificación→ `app.eventos_dirigidos.notificador.Notificador` (extendido con
  `notificar_solicitud`, mismos canales/reintento/safety gate)
- Directorio           → `app.eventos_dirigidos.directorio` (mismo registro, sin email libre)
- registro FAT         → familia F10 (`evento_tipo="solicitud"`)

Este paquete solo AGREGA lo propio de las solicitudes:

- `tipos`      — catálogo `:TipoSolicitud` por tenant (tipado abierto §3.1.1) +
  semilla de 5 + promoción de etiquetas libres.
- `inferencia` — mapeo determinístico contexto→tipo (config versionada, NO LLM).
- `modelo`     — `:Solicitud` (dataclass + almacén Supabase / en memoria).
- `servicio`   — crear (nodo grafo + `:DERIVA_DE` + fila Supabase + notificación) y
  transiciones de ciclo de vida.
"""
