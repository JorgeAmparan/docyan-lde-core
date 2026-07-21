-- ============================================================
-- Migración 023: Directorio de Destinatarios del tenant (ED-1 §2.5 / Adenda ED §5)
-- Fecha: 2026-07-20
-- Bloque: ED-1 (Eventos Dirigidos — Pilar 2 Alertas)
-- Descripción:
--   Guardrail canónico del ruteo de eventos dirigidos: EL ADMIN DA DE ALTA, EL
--   OPERADOR SOLO SELECCIONA. Ningún endpoint de envío acepta un email libre —
--   solo `destinatario_id` que resuelve contra este directorio. Alimenta tanto
--   `ReglaAlerta` (destinatarios de alertas) como el selector de solicitudes (ED-2).
--
--   Tipos:
--     · proveedor_externo   → nombre + email + empresa + categorías (no requiere
--                             cuenta DOCYAN; la apertura está en el alta del admin).
--     · departamento_interno→ resuelve a usuarios miembros (JSONB de user_ids).
--     · colaborador         → un usuario DOCYAN del tenant (usuario_id).
--
--   Aislamiento: operada por el backend con SUPABASE_SERVICE_KEY (bypassa RLS,
--   igual que orgs/quota). RLS habilitado con policy de aislamiento por org.
--   Aditiva e idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS destinatarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                         -- tenant (== org_id de la sesión)
    tipo TEXT NOT NULL
        CHECK (tipo IN ('proveedor_externo', 'departamento_interno', 'colaborador')),
    nombre TEXT NOT NULL,
    -- Email para proveedor_externo (destino real del correo). Nulo para depto/colab
    -- (se resuelve vía usuarios). Validado en el backend, no aquí.
    email TEXT,
    empresa TEXT,                                 -- proveedor_externo
    usuario_id TEXT,                              -- colaborador → users.id
    -- departamento_interno → lista de user_ids miembros (resueltos a email/in-app).
    miembros JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Categorías/etiquetas de servicio (proveedor) para filtrado del selector.
    categorias JSONB NOT NULL DEFAULT '[]'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_destinatarios_org_id ON destinatarios(org_id);
CREATE INDEX IF NOT EXISTS idx_destinatarios_tipo ON destinatarios(org_id, tipo);
CREATE INDEX IF NOT EXISTS idx_destinatarios_activo ON destinatarios(org_id, activo);

ALTER TABLE destinatarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "destinatarios_org_isolation" ON destinatarios;
CREATE POLICY "destinatarios_org_isolation" ON destinatarios
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));
