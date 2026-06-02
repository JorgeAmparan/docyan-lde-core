-- ============================================================
-- Migración 010: Tabla dtm_projects
-- Fecha: 2026-06-01
-- Bloque: B3 §5 / "Componentes en código" — registro de proyectos de traducción.
-- Descripción: Metadato operacional mínimo de los proyectos de traducción a los
--              que pertenece un `:SegmentoTraduccion` vía la arista
--              `:PERTENECE_A_PROYECTO`. El nodo `:Proyecto` en el grafo DTM
--              referencia esta fila por `proyecto_id` (columna id). Aquí vive el
--              metadato relacional (estado, par lingüístico, agencia/cliente);
--              el grafo lleva solo el ancla. Multi-tenant strict (RLS por
--              tenant_id). Acceso del backend con SUPABASE_SERVICE_KEY.
--
--              ALCANCE B3 (cimientos): solo el registro. El flujo de asignación
--              de revisores y cotización por proyecto es B11 (UI PM Dashboard);
--              el motor de traducción que opera sobre el proyecto es B4/B5.
-- ============================================================

CREATE TABLE dtm_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    -- Par lingüístico DIRECCIONAL canónico, p. ej. 'en-US_es-MX' (coincide con
    -- el par_id del graph_name DTM; ver app/graph/dtm_segregation.py).
    par_linguistico TEXT NOT NULL,
    -- Estado del proyecto. En B3 solo se modela; el flujo lo gobierna B11.
    estado TEXT NOT NULL DEFAULT 'activo',
    -- Origen del proyecto: cliente final directo (Pista A) o agencia (Pista B).
    tipo_origen TEXT NOT NULL DEFAULT 'cliente',
    cliente_id TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dtm_projects_tenant ON dtm_projects(tenant_id);
CREATE INDEX idx_dtm_projects_par ON dtm_projects(tenant_id, par_linguistico);

ALTER TABLE dtm_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dtm_projects_isolation" ON dtm_projects
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

CREATE OR REPLACE FUNCTION update_dtm_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dtm_projects_updated_at
    BEFORE UPDATE ON dtm_projects
    FOR EACH ROW EXECUTE FUNCTION update_dtm_projects_updated_at();
