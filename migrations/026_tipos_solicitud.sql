-- ============================================================
-- Migración 026: Catálogo :TipoSolicitud por tenant (ED-2 §2.1 / Adenda ED §3.1.1)
-- Fecha: 2026-07-21
-- Bloque: ED-2 (Solicitudes — Pilar 3, Data Accionable)
-- Descripción:
--   Catálogo de tipos de solicitud POR TENANT (tipado abierto §3.1.1): NO es un
--   enum de código. Semilla de cinco al onboarding (cotizacion | servicio |
--   mantenimiento | revision | tarea) + backfill de tenants existentes; el admin
--   agrega los propios (ej. "verificación metrológica", "reabastecimiento"). Cada
--   tipo define: nombre, campos tipados opcionales (JSON schema ligero) y tipos de
--   destinatario sugeridos. El tipado NUNCA limita — la opción "Otra" con
--   etiqueta_libre convive con los tipos formales y las etiquetas repetidas se
--   proponen al admin para promoverse a un tipo (taxonomía emergente).
--
--   `clave` es el slug estable de los tipos semilla (cotizacion, servicio, ...),
--   usado por la inferencia contexto→tipo (§2.3) y por el marcado accionable del
--   payload de consulta (§2.4). Los tipos que agrega el admin llevan `clave` NULL.
--
--   Aislamiento: backend con SUPABASE_SERVICE_KEY (bypassa RLS). RLS por org.
--   Aditiva e idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_solicitud (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                          -- tenant (== org_id de la sesión)
    -- Slug estable de los tipos semilla (cotizacion|servicio|mantenimiento|revision|
    -- tarea). NULL para los que agrega el admin. Alimenta la inferencia §2.3/§2.4.
    clave TEXT,
    nombre TEXT NOT NULL,
    -- Campos tipados opcionales del formulario: [{clave, etiqueta, tipo, requerido}].
    campos JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Tipos de destinatario sugeridos para este tipo (proveedor_externo, etc.).
    destinatarios_sugeridos JSONB NOT NULL DEFAULT '[]'::jsonb,
    es_base BOOLEAN NOT NULL DEFAULT FALSE,        -- TRUE para los 5 semilla
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tipos_solicitud_org_id ON tipos_solicitud(org_id);
CREATE INDEX IF NOT EXISTS idx_tipos_solicitud_activo ON tipos_solicitud(org_id, activo);
-- Un slug semilla es único por tenant (la semilla es idempotente por (org, clave)).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_solicitud_org_clave
    ON tipos_solicitud(org_id, clave) WHERE clave IS NOT NULL;

ALTER TABLE tipos_solicitud ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tipos_solicitud_org_isolation" ON tipos_solicitud;
CREATE POLICY "tipos_solicitud_org_isolation" ON tipos_solicitud
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));
