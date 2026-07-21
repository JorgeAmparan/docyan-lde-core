# Sprint Contract ED-2 — Solicitudes: Pilar 3 completo (Data Accionable)

XCID SA de CV — DOCYAN LDE™ — Julio 2026
Repo: docyan-lde-core
Rige: DOCYAN_Adenda_Eventos_Dirigidos.md §1, §3, §4, §5 (incl. §3.1.1)
Prerequisito: ED-1 mergeado y desplegado (base eventos_dirigidos, motor de
notificación, Directorio de Destinatarios)

Modo: UNA aprobación + ejecución completa + UN reporte final. Migraciones
aditivas las aplica Opus directamente (política vigente). Cero "PENDIENTE
DE JORGE" salvo decisión genuina.

## 1. Contexto
El Pilar 3 no existe (auditoría: cero hits de "solicitud" en el repo). Este
sprint lo construye completo sobre la base de ED-1: un dato con provenance
dispara una solicitud tipada a un destinatario configurable. Pieza central
de la propuesta de valor para InnovaFest y pilotos.

## 2. Alcance

### 2.1 Catálogo :TipoSolicitud por tenant (tipado abierto §3.1.1)
1. Semilla de 5 al onboarding + backfill de tenants existentes:
   cotizacion | servicio | mantenimiento | revision | tarea. Cada tipo:
   nombre, campos tipados opcionales (JSON schema ligero), tipos de
   destinatario sugeridos.
2. CRUD admin (/tipos-solicitud), scope tenant.
3. Opción "Otra" con etiqueta_libre: se captura igual que un tipo formal.
   Etiquetas repetidas (>=3 en el tenant) se registran como propuesta de
   promoción visible al admin (endpoint de propuestas; aceptar = crear el
   tipo). El sistema propone el tipo, jamás la acción.

### 2.2 Modelo :Solicitud (persistencia dual)
- FalkorDB: nodo :Solicitud + arista :DERIVA_DE al dato de origen. Scope
  multi-tenant estricto.
- Supabase: tabla solicitudes (listados, ruteo, inteligencia de demanda).
- Campos: solicitud_id, tipo_id (FK catálogo), etiqueta_libre (opcional),
  estado (ciclo de vida común de eventos_dirigidos), dato_origen (nodo +
  documento_id + span_inicio/fin + fragmento verbatim — LA SOLICITUD
  HEREDA EL PROVENANCE DE LA CONSULTA), consulta_id (ref FAT),
  solicitante_id, destinatario_id (FK Directorio — ÚNICO camino, jamás
  email libre), mensaje, campos_tipados (JSON), entidad_id / codo_id /
  tenant_id, timestamps de creación/resolución.

### 2.3 Inferencia determinística contexto→tipo
Tabla de mapeo (config versionada, NO LLM): (tipo de intención, tipo de
documento/entidad del dato) → tipo sugerido. Ej.: catálogo de partes →
cotización; evento de inspección sobre equipo → mantenimiento; documento
de proveedor → servicio. El formulario abre con el tipo preseleccionado;
el usuario lo cambia con un tap. El sistema muestra, el humano decide.

### 2.4 Marcado de datos accionables (backend decide, frontend renderiza)
El payload de respuesta de consulta (mínimo: Informativa, Comparativa,
Historial sobre partes/servicios/fechas) incluye por dato un flag
accionable + tipo_sugerido cuando el mapeo §2.3 aplica. Determinístico
por tipo de dato/render — nunca el LLM "recomendando". El frontend solo
muestra el botón donde el backend marcó.

### 2.5 Endpoints
/solicitudes: crear (valida destinatario_id del Directorio; hereda
provenance; dispara notificación), listar enviadas/recibidas (bandeja,
filtros por estado/tipo), detalle, transiciones de estado (leida,
en_proceso, resuelta, cancelada — cada una con FAT). Payloads Pydantic
estrictos; tipos TypeScript generados.

### 2.6 Ruteo y notificación (vía motor ED-1)
- Interno (usuario/departamento del tenant): in-app + email; bandeja de
  recibidas.
- Externo (proveedor sin cuenta): email vía Resend con contenido de la
  solicitud, cita de origen (fragmento verbatim, no el documento), datos
  de contacto del solicitante, branding DOCYAN. reply-to = solicitante.
  Sin acceso al tenant.
- Toda plantilla pasa safety_validator (jamás sugiere decisión
  operativa/clínica).
- FAT por creación, envío y cada transición.

### 2.7 Inteligencia de demanda (captura, no UI)
La tabla solicitudes persiste tipo, entidad, dato de origen, destinatario
y tiempos de ciclo. Sin visualización en este sprint. Frecuencia-sí /
causa-no.

### 2.8 UI provisional funcional (autorizada para demo; definitiva en ED-4)
1. Botón contextual "Solicitar" en los renderers donde el payload marque
   accionable.
2. Formulario modal: tipo (inferido, cambiable, del catálogo + "Otra"),
   destinatario (selector del Directorio), mensaje, campos tipados si el
   tipo los define. Prellenado con el dato y su cita.
3. Bandeja mínima (enviadas/recibidas con estado) en la app autenticada.
Reglas: usar EXCLUSIVAMENTE el vocabulario visual existente del Design
System (clases del kit, card/chip/modal ya establecidos) — cero diseño
inventado; superficie provisional que se reemplaza con el porteo fiel del
prototipo (ED-4). Marcar componentes con comentario PROVISIONAL-ED2.

## 3. Fuera de alcance
UI definitiva (prototipo/ED-4), campana de notificaciones (ED-4),
reporting de demanda, canal push, portal de respuesta para externos
(post-MVP, documentado en la Adenda).

## 4. Tests
1. Guardrail: solicitud con email libre o destinatario de otro tenant →
   422/403.
2. Inferencia: mapeo produce el tipo correcto; dato no mapeado → sin flag.
3. Provenance heredado: la solicitud contiene documento_id + span +
   fragmento de la cita de origen.
4. Ciclo de vida: transiciones válidas/inválidas + FAT (reusa la máquina
   de ED-1).
5. Ruteo externo: email con fragmento + reply-to correcto (Resend
   mockeado); interno: in-app persistida.
6. safety_validator bloquea plantilla no-administrativa.
7. Promoción: 3 etiquetas libres iguales → propuesta registrada; aceptar →
   tipo creado.
8. Demanda: campos de ciclo persistidos.
9. Convivencia: T1-T8 y demo pública sin regresión.

## 5. Salida verificable
1. CI verde; deploy (backend, frontend, worker si aplica).
2. CICLO COMPLETO EN PROD: consulta real en el CoDo Revolvedora (catálogo
   de partes) → dato marcado accionable → botón → formulario con
   "cotización" inferido → solicitud creada → EMAIL REAL recibido con la
   cita del catálogo → visible en bandeja → transición a resuelta → FAT
   completo de punta a punta.
3. Inventario: endpoints, tablas/nodos, migraciones (aplicadas por Opus),
   mapeo contexto→tipo versionado.
4. Evidencia de que el flag accionable NO aparece en datos sin mapeo
   (no-sobre-marcado).

## 6. Notas de integración
- Rama nueva desde main post-ED-1 (feat/ed2-solicitudes).
- Consumir la base eventos_dirigidos de ED-1 — prohibido duplicar máquina
  de estados o motor de notificación.
- Timeouts en todo cliente nuevo (regla ED-0 permanente).
- Migraciones: numeración consecutiva tras las de ED-1; EXPECTED_TABLES
  en el mismo PR; aditivas → las aplica Opus.