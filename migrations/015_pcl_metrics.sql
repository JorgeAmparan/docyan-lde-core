-- ============================================================
-- Migración 015: Capa de Contexto Persistente (CCP/PCL) — métricas + config
-- Fecha: 2026-06-02
-- Bloque: B8.5 — doc docs/00_CCP_Arquitectura.md §7.
-- Descripción: Instrumentación agregada por DoCo/día + configuración del caché
--   por DoCo. Sin estas métricas el modelo de pricing no se defiende
--   empíricamente desde el primer piloto (doc §7.4).
--   - pcl_metrics_daily: agregado diario (la tarea del scheduler 03:00h lo llena;
--     el endpoint admin GET /admin/pcl/metrics lo lee).
--   - pcl_cache_config: umbral de similitud + TTL del caché por DoCo (doc §5.5).
--   Multi-tenant strict (RLS por tenant_id == org_id, vía current_setting
--   app.org_id — misma convención que 014/013/011). El backend accede con
--   SUPABASE_SERVICE_KEY (bypassa RLS). id TEXT (consistente con el resto del
--   esquema DOCYAN, no UUID nativo — ajuste documentado sobre el borrador del
--   contrato).
-- ============================================================

-- ── Métricas agregadas por DoCo/día ─────────────────────────────────────────
CREATE TABLE pcl_metrics_daily (
    -- id con default en DB: la fila se hace UPSERT por (tenant_id, fecha) desde el
    -- agregador (no se provee id); el default lo genera en el INSERT y permanece
    -- estable en el UPDATE. gen_random_uuid() es nativo en PG13+ (Supabase = PG15).
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    fecha DATE NOT NULL,
    consultas_totales INTEGER NOT NULL DEFAULT 0,
    consultas_cache_hit INTEGER NOT NULL DEFAULT 0,
    consultas_retrieval_first INTEGER NOT NULL DEFAULT 0,
    consultas_synthesis_first INTEGER NOT NULL DEFAULT 0,
    costo_total_centavos NUMERIC(12,4) NOT NULL DEFAULT 0,
    costo_promedio_por_consulta NUMERIC(8,4) NOT NULL DEFAULT 0,
    costo_promedio_por_consulta_unica NUMERIC(8,4) NOT NULL DEFAULT 0,
    latencia_p50_ms INTEGER NOT NULL DEFAULT 0,
    latencia_p95_ms INTEGER NOT NULL DEFAULT 0,
    top_patrones_detectados JSONB NOT NULL DEFAULT '[]'::jsonb,
    sugerencias_emitidas INTEGER NOT NULL DEFAULT 0,
    sugerencias_aceptadas INTEGER NOT NULL DEFAULT 0,
    sugerencias_rechazadas INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, fecha)
);
CREATE INDEX idx_pcl_metrics_tenant_fecha ON pcl_metrics_daily(tenant_id, fecha DESC);

ALTER TABLE pcl_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcl_metrics_isolation" ON pcl_metrics_daily
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

-- ── Configuración del caché por DoCo (umbral + TTL) ─────────────────────────
CREATE TABLE pcl_cache_config (
    tenant_id TEXT PRIMARY KEY,
    umbral_similitud NUMERIC(3,2) NOT NULL DEFAULT 0.92,
    ttl_segundos INTEGER NOT NULL DEFAULT 2592000,  -- 30 días (doc §5.5)
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pcl_cache_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcl_cache_config_isolation" ON pcl_cache_config
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));
