-- ============================================================
-- Migración 011: Tabla sessions_completed
-- Fecha: 2026-06-02
-- Bloque: B4 §3 — Session Manager del Master Orchestrator (decisión #6).
-- Descripción: Spillover de sesiones COMPLETADAS desde Redis a Supabase. Las
--              sesiones vivas viven en Redis con TTL diferenciado (sliding
--              window por tipo: consulta 30m, troubleshooting 2h, revisión 8h,
--              onboarding 30d). Al cerrarse (close_session), la sesión se mueve
--              aquí para análisis histórico y FAT (el FAT permanente lo lleva
--              audit_trail; esta tabla guarda el ESTADO final de la sesión).
--              Multi-tenant strict (RLS por tenant_id == org_id). El backend
--              accede con SUPABASE_SERVICE_KEY (bypassa RLS), igual que
--              tenant_budget (008) y api_keys (007).
-- ============================================================

CREATE TABLE sessions_completed (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    session_type TEXT NOT NULL,
    canal TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    state JSONB DEFAULT '{}'::jsonb,
    closed_reason TEXT
);

CREATE INDEX idx_sessions_completed_tenant ON sessions_completed(tenant_id);
CREATE INDEX idx_sessions_completed_user ON sessions_completed(user_id);
CREATE INDEX idx_sessions_completed_type ON sessions_completed(session_type);
CREATE INDEX idx_sessions_completed_closed_at ON sessions_completed(closed_at);

ALTER TABLE sessions_completed ENABLE ROW LEVEL SECURITY;

-- Aislamiento multi-tenant: la GUC app.org_id la fija la app (org_id == tenant_id
-- en DOCYAN). Consistente con tenant_budget (008) y api_keys (007).
CREATE POLICY "sessions_completed_isolation" ON sessions_completed
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));
