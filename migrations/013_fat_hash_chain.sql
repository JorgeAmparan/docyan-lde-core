-- ============================================================
-- Migración 013: FAT extendido (hash chain SHA-256) + ConfiguracionGRG (B7)
-- Fecha: 2026-06-02
-- Bloque: B7 — GRG extendido (8 familias) + FAT extendido (9 familias + SHA-256).
-- Descripción:
--   1. Extiende `audit_trail` (004) de forma ADITIVA con las columnas del nodo
--      :EventoFAT del doc 08 y la cadena criptográfica. No rompe a
--      app/core/matrix.py (que sigue escribiendo component/action/detail).
--   2. Crea `fat_retention_policy` (decisión #12 Paso C): años de retención por
--      familia FAT. Tabla de referencia global; RLS habilitada como defensa en
--      profundidad (el backend la lee con service_role).
--   3. Crea `configuracion_grg` por tenant: tier del cliente + umbrales F2
--      ajustables (override de los defaults del doc 07). Multi-tenant strict.
--
--   El hash chain es GLOBAL por tenant (no por almacenamiento). Esta tabla cubre
--   los eventos de ALTA FRECUENCIA (F4 consulta, F5 troubleshooting, F6 alertas,
--   F9 sistema); los eventos críticos (F1/F2/F3/F7) viven además como :EventoFAT
--   en FalkorDB enlazados al DKG/DTM. El verificador de integridad
--   (app/audit/integrity_checker.py) lee de ambos lados y los entrelaza por
--   timestamp para validar la cadena cronológica del tenant.
-- ============================================================

-- ── 1. audit_trail: columnas del :EventoFAT + hash chain ─────────────────────
-- Aditivo: el `id` existente cumple `evento_id`; `created_at` cumple `timestamp`;
-- `org_id` cumple `tenant_id`; `actor` cumple `actor_id`.

ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS tipo_evento TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS familia TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS actor_tipo TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS entidad_afectada_tipo TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS entidad_afectada_id TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- Cadena criptográfica SHA-256 (doc 08). hash_evento_anterior NULL/'' = génesis.
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS hash_evento TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS hash_evento_anterior TEXT;
-- Inmutabilidad append-only: corrección = nuevo evento apuntando al original.
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS corrige_evento_id UUID;

-- Índices para el verificador de integridad (recorre la cadena por tenant en
-- orden cronológico) y para los reportes auditables (filtros por familia/fecha).
CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_created
    ON audit_trail(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_familia ON audit_trail(familia);
CREATE INDEX IF NOT EXISTS idx_audit_trail_hash_evento ON audit_trail(hash_evento);
CREATE INDEX IF NOT EXISTS idx_audit_trail_corrige ON audit_trail(corrige_evento_id);

-- ── 2. fat_retention_policy (decisión #12 Paso C) ────────────────────────────

CREATE TABLE fat_retention_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- familia FAT (F1..F9). Único: una política por familia.
    familia TEXT NOT NULL UNIQUE,
    anios_retencion INTEGER NOT NULL CHECK (anios_retencion > 0),
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fat_retention_familia ON fat_retention_policy(familia);

ALTER TABLE fat_retention_policy ENABLE ROW LEVEL SECURITY;

-- Tabla de referencia global (no por tenant). El backend la lee con service_role
-- (bypassa RLS). La política permite lectura a cualquier rol autenticado; RLS
-- queda habilitada como defensa en profundidad (consistencia con el resto del
-- schema, donde toda tabla tiene RLS + al menos una política).
CREATE POLICY "fat_retention_policy_read" ON fat_retention_policy
    USING (true)
    WITH CHECK (true);

-- Defaults del doc 08 / decisión #12.
INSERT INTO fat_retention_policy (familia, anios_retencion, descripcion) VALUES
    ('F1', 7, 'Pipeline de traducción (Pista A) — inerte hasta B5'),
    ('F2', 7, 'Revisión humana (Pista A Tier 2/3) — inerte hasta B5'),
    ('F3', 7, 'Ingesta bilingüe (Pista B) — inerte hasta B5'),
    ('F4', 3, 'Consulta operativa'),
    ('F5', 3, 'Troubleshooting (Tipo 5)'),
    ('F6', 3, 'Alertas (Tipo 7, solo administrativas)'),
    ('F7', 7, 'Gobernanza (GRG)'),
    ('F8', 5, 'Onboarding'),
    ('F9', 2, 'Sistema y meta-FAT');

-- ── 3. configuracion_grg por tenant ──────────────────────────────────────────

CREATE TABLE configuracion_grg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL UNIQUE,
    -- Tier del cliente (decisión Pista B + Pista A análogo).
    tier TEXT NOT NULL DEFAULT 'base'
        CHECK (tier IN ('base', 'profesional', 'enterprise')),
    -- Override de umbrales F2 (doc 07). NULL/ausente = defaults del catálogo.
    -- { "seguridad": 0.95, "regulatorio": 0.90, "calidad": 0.85,
    --   "operacional": 0.75, "informativa": 0.60 }
    umbrales_f2 JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_configuracion_grg_tenant ON configuracion_grg(tenant_id);

ALTER TABLE configuracion_grg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracion_grg_isolation" ON configuracion_grg
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));
