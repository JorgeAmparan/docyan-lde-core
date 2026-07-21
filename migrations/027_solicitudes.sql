-- ============================================================
-- Migración 027: Modelo :Solicitud — persistencia operacional (ED-2 §2.2 / Adenda ED §3.1)
-- Fecha: 2026-07-21
-- Bloque: ED-2 (Solicitudes — Pilar 3, Data Accionable)
-- Descripción:
--   Persistencia DUAL de la solicitud (evento dirigido disparado por el usuario):
--     · FalkorDB: nodo :Solicitud + arista :DERIVA_DE al dato de origen (scope por
--       graph_name/tenant). Lo maneja app/solicitudes/servicio.py.
--     · Supabase (esta tabla): listados/bandeja, ruteo e inteligencia de demanda
--       (§2.7 — captura desde MVP; frecuencia-sí / causa-no).
--
--   LA SOLICITUD HEREDA EL PROVENANCE DE LA CONSULTA que la originó: documento_id +
--   span_inicio/fin + fragmento verbatim de la cita del dato de origen (§2.2). El
--   destinatario_id resuelve SIEMPRE contra el Directorio (mig 023) — jamás email
--   libre (guardrail canónico §5). `estado` usa el ciclo de vida común de eventos
--   dirigidos (mig 023-025 / app.eventos_dirigidos.ciclo_vida).
--
--   Aislamiento: backend con SUPABASE_SERVICE_KEY. RLS por org. Aditiva/idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- solicitud_id
    org_id TEXT NOT NULL,                             -- tenant_id (== org_id)
    -- Tipo del catálogo por tenant (mig 026). NULL solo cuando el usuario eligió
    -- "Otra" y capturó una etiqueta_libre (§3.1.1).
    tipo_id UUID REFERENCES tipos_solicitud(id) ON DELETE SET NULL,
    tipo_nombre TEXT,                                 -- denormalizado (listados/bandeja)
    etiqueta_libre TEXT,                              -- solo con "Otra"; taxonomía emergente
    estado TEXT NOT NULL DEFAULT 'creado',            -- ciclo de vida común §1.1
    -- ── Provenance heredado del dato de origen (§2.2) ──────────────────────────
    dato_origen_nodo_id TEXT,                         -- nodo del grafo del dato de origen
    documento_id TEXT,
    span_inicio INTEGER,
    span_fin INTEGER,
    fragmento TEXT,                                   -- cita VERBATIM del catálogo/doc
    consulta_id TEXT,                                 -- sesión/consulta FAT que la disparó
    -- ── Actores y ruteo ───────────────────────────────────────────────────────
    solicitante_id TEXT,                             -- users.id que creó la solicitud
    solicitante_nombre TEXT,
    solicitante_email TEXT,                           -- reply-to del email al externo
    destinatario_id UUID NOT NULL,                    -- FK Directorio (mig 023) — ÚNICO camino
    mensaje TEXT,                                     -- campo libre del formulario
    campos_tipados JSONB NOT NULL DEFAULT '{}'::jsonb,-- por tipo (cantidad, num_parte, ...)
    entidad_id TEXT,
    codo_id TEXT,
    -- ── Tiempos de ciclo (inteligencia de demanda §2.7) ───────────────────────
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_resolucion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_org_id ON solicitudes(org_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo ON solicitudes(org_id, tipo_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante ON solicitudes(org_id, solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_destinatario ON solicitudes(org_id, destinatario_id);
-- Propuestas de promoción (§2.1.3): agregación de etiquetas libres repetidas.
CREATE INDEX IF NOT EXISTS idx_solicitudes_etiqueta_libre
    ON solicitudes(org_id, etiqueta_libre) WHERE etiqueta_libre IS NOT NULL;

ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solicitudes_org_isolation" ON solicitudes;
CREATE POLICY "solicitudes_org_isolation" ON solicitudes
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));
