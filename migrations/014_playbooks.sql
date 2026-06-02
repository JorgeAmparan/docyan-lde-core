-- ============================================================
-- Migración 014: Mecánica de Playbooks de Consulta (Niveles A/B/C)
-- Fecha: 2026-06-02
-- Bloque: B8 §B — Clasificador + Pipelines + Playbooks (Adenda MVP Consulta Viva).
-- Descripción: Materializa el Nivel 3 visible como Playbooks (doc de visión).
--   - Nivel A: consultas_guardadas (la consulta viva, por nombre).
--   - Nivel B: playbooks + playbook_pasos (secuencia/recorrido).
--   - Nivel C: sugerencias_playbook (compuerta de 3 señales) +
--              patrones_rechazados_por_usuario (aprendizaje del rechazo local).
--   Más dos banderas en users para la IA proactiva (toggles expuestos en B13).
--   Multi-tenant strict (RLS por tenant_id == org_id, vía current_setting
--   app.org_id). El backend accede con SUPABASE_SERVICE_KEY (bypassa RLS), igual
--   que sessions_completed (011), tenant_budget (008) y api_keys (007).
-- ============================================================

-- ── Nivel A — Consultas guardadas (átomo) ───────────────────────────────────
CREATE TABLE consultas_guardadas (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    consulta_original TEXT NOT NULL,
    tipo_intencion TEXT NOT NULL,
    tipo_documento_origen TEXT,
    entidad_referenciada_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    disparos_totales INTEGER NOT NULL DEFAULT 0,
    ultimo_disparo_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_consultas_guardadas_tenant ON consultas_guardadas(tenant_id);
CREATE INDEX idx_consultas_guardadas_user ON consultas_guardadas(tenant_id, user_id);
CREATE INDEX idx_consultas_guardadas_entidad ON consultas_guardadas(tenant_id, entidad_referenciada_id);

ALTER TABLE consultas_guardadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultas_guardadas_isolation" ON consultas_guardadas
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

-- ── Nivel B — Playbooks (secuencia) ─────────────────────────────────────────
CREATE TABLE playbooks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    creado_por_user_id TEXT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo_creacion TEXT NOT NULL DEFAULT 'usuario_manual'
        CHECK (tipo_creacion IN ('usuario_manual', 'precargado_vertical', 'sugerencia_edb_aceptada')),
    vertical TEXT,
    disparos_totales INTEGER NOT NULL DEFAULT 0,
    ultimo_disparo_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_playbooks_tenant ON playbooks(tenant_id);
CREATE INDEX idx_playbooks_user ON playbooks(tenant_id, creado_por_user_id);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playbooks_isolation" ON playbooks
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

-- ── Nivel B — Pasos del Playbook ────────────────────────────────────────────
-- tenant_id denormalizado para RLS consistente (igual patrón que el resto).
CREATE TABLE playbook_pasos (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL,
    consulta_guardada_id TEXT NOT NULL REFERENCES consultas_guardadas(id),
    nota_paso TEXT
);
CREATE INDEX idx_playbook_pasos_playbook ON playbook_pasos(playbook_id);
CREATE INDEX idx_playbook_pasos_consulta ON playbook_pasos(consulta_guardada_id);

ALTER TABLE playbook_pasos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playbook_pasos_isolation" ON playbook_pasos
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

-- ── Nivel C — Sugerencias de Playbook ───────────────────────────────────────
CREATE TABLE sugerencias_playbook (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tipo_sugerencia TEXT NOT NULL
        CHECK (tipo_sugerencia IN ('pedagogica', 'inteligencia')),
    consulta_guardada_ids JSONB DEFAULT '[]'::jsonb,
    evidencia_estructural JSONB DEFAULT '{}'::jsonb,
    evidencia_conductual JSONB DEFAULT '{}'::jsonb,
    estado TEXT NOT NULL DEFAULT 'propuesta'
        CHECK (estado IN ('propuesta', 'aceptada', 'rechazada', 'ignorada', 'accion_aplicada')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decidido_at TIMESTAMPTZ
);
CREATE INDEX idx_sugerencias_playbook_tenant ON sugerencias_playbook(tenant_id);
CREATE INDEX idx_sugerencias_playbook_user ON sugerencias_playbook(tenant_id, user_id);
CREATE INDEX idx_sugerencias_playbook_estado ON sugerencias_playbook(tenant_id, user_id, estado);

ALTER TABLE sugerencias_playbook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sugerencias_playbook_isolation" ON sugerencias_playbook
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

-- ── Nivel C — Aprendizaje del rechazo local ─────────────────────────────────
CREATE TABLE patrones_rechazados_por_usuario (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    firma_patron TEXT NOT NULL,
    conteo_rechazos INTEGER NOT NULL DEFAULT 0,
    ultimo_rechazo_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_patrones_rechazados_unq
    ON patrones_rechazados_por_usuario(tenant_id, user_id, firma_patron);

ALTER TABLE patrones_rechazados_por_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrones_rechazados_isolation" ON patrones_rechazados_por_usuario
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));

-- ── Banderas de IA proactiva en el usuario (toggles UI en B13) ──────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS permiso_ia_proactiva BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS silenciar_sugerencias BOOLEAN NOT NULL DEFAULT FALSE;
