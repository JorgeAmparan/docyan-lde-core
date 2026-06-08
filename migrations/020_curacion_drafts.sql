-- ==============================================================================
-- 020_curacion_drafts.sql — Borradores de curación asistida (B9.5)
-- ==============================================================================
-- DOCYAN LDE™ by XCID.
--
-- Store COMPARTIDO de borradores T3/T5: el worker (docyan-lde-ingest) auto-extrae
-- el borrador del documento al ingerir y lo persiste aquí; el backend
-- (docyan-lde-api) lo sirve al editor de curación para revisión humana. Son
-- procesos Fly separados, por eso el borrador vive en Postgres, no en memoria.
--
-- Multi-tenant strict: aislamiento por tenant_id (clave compuesta).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS curacion_drafts (
    tenant_id   text        NOT NULL,
    draft_id    text        NOT NULL,
    -- Snapshot del borrador completo: {draft_id, draft:{kind,...}, doc_id, entidad_id}.
    data        jsonb       NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, draft_id)
);

-- Listado del editor por tenant (borradores pendientes de curar).
CREATE INDEX IF NOT EXISTS idx_curacion_drafts_tenant
    ON curacion_drafts (tenant_id, updated_at DESC);
