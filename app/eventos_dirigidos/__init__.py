"""
Subsistema de Eventos Dirigidos — base común Alerta + Solicitud (Adenda ED §1).

DOCYAN LDE™ by XCID.

Alertas (disparadas por el sistema) y Solicitudes (disparadas por el usuario, ED-2)
son **un solo subsistema** con dos disparadores. Este paquete concentra lo que
ambos comparten para que ED-2 solo AGREGUE, no refactorice:

- `ciclo_vida`  — máquina de estados común + acciones válidas (transición inválida
  = error explícito, nunca silencio). Cada transición registra FAT (familia F10).
- `directorio`  — Directorio de Destinatarios del tenant (§5): el admin da de alta,
  el operador solo selecciona; ningún envío acepta un email libre.
- `notificaciones_inapp` — centro de notificaciones in-app (backend; la campana UI
  es ED-4).
- `resend_client` / `plantillas` / `notificador` — motor de notificación único
  (Resend email + in-app), plantillas paramétricas por idioma, gate obligatorio de
  `safety_validator` sobre el mensaje final, envío fuera del request path con
  reintento con backoff.

Los módulos `alerts/`, `eventos/`, `notifications/` se reconcilian consumiendo esta
base — no se crea una cuarta ruta paralela.
"""
