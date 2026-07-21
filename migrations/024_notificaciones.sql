-- ============================================================
-- Migración 024: Centro de notificaciones in-app (ED-1 §2.4.2 / Adenda ED §4)
-- Fecha: 2026-07-20
-- Bloque: ED-1 (Eventos Dirigidos — motor de notificación)
-- Descripción:
--   Canal in-app del motor de notificación único. Cada creación de `:Alerta` (y en
--   ED-2 cada `:Solicitud`) inserta aquí una notificación por destinatario interno
--   resuelto. La campana UI es de ED-4; aquí solo el backend.
--
--   `estado` refleja la entrega del canal EMAIL asociado / el propio in-app:
--     enviada  → entregada al centro in-app (y email invocado con éxito si aplica)
--     leida    → el usuario la marcó leída
--     fallida  → el envío por email agotó los reintentos (visible al admin, §2.4.4)
--
--   Aislamiento: backend con SUPABASE_SERVICE_KEY. RLS por org. Aditiva/idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                         -- tenant (== org_id)
    usuario_id TEXT,                              -- destinatario interno (users.id); nulo si solo email externo
    -- Familia/tipo del evento que la originó (alerta_vencimiento, alerta_manual, ...).
    tipo_evento TEXT NOT NULL,
    -- Referencia al evento dirigido de origen (id del :Alerta / :Solicitud).
    evento_ref TEXT,
    destinatario_id TEXT,                          -- fila de `destinatarios` que resolvió el envío
    canal TEXT NOT NULL DEFAULT 'in_app'
        CHECK (canal IN ('in_app', 'email')),
    titulo TEXT NOT NULL,
    cuerpo TEXT NOT NULL,                          -- mensaje renderizado (ya pasó safety_validator)
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    estado TEXT NOT NULL DEFAULT 'enviada'
        CHECK (estado IN ('enviada', 'leida', 'fallida')),
    error TEXT,                                    -- motivo del fallo definitivo (canal email)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    leida_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_org_id ON notificaciones(org_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(org_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas ON notificaciones(org_id, usuario_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones(org_id, estado);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notificaciones_org_isolation" ON notificaciones;
CREATE POLICY "notificaciones_org_isolation" ON notificaciones
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));
