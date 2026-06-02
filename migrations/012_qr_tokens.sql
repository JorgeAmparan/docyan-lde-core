-- ============================================================
-- Migración 012: Tabla qr_tokens
-- Fecha: 2026-06-02
-- Bloque: B4 §6 — Tokens QR persistentes del Master Orchestrator.
-- Descripción: Registro de los tokens QR emitidos. Un token QR vincula a una
--              :EntidadOperativa del DKG (B1) y codifica una URL pública
--              (https://docyan-lde-api.fly.dev/qr/<token>). El token mismo es la
--              credencial (firma HMAC-SHA256 con secret de la app + nonce); este
--              registro permite REVOCAR (revoked_at) y, opcionalmente, EXPIRAR
--              (expires_at NULL = persistente por default, decisión #11 del
--              contrato B4). Multi-tenant ABSOLUTO: un QR de un tenant nunca
--              resuelve entidades de otro (el resolver valida tenant_id del token
--              y responde 404 si no coincide, para no filtrar existencia).
--              Backend accede con SUPABASE_SERVICE_KEY (bypassa RLS), igual que
--              tenant_budget (008). RLS = defensa en profundidad.
-- ============================================================

CREATE TABLE qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    -- id del nodo :EntidadOperativa en el grafo del tenant (DKG, B1).
    entidad_id_dkg TEXT NOT NULL,
    -- nonce aleatorio que entra en la firma HMAC; permite revocar/rotar un token
    -- para una misma entidad sin colisión.
    nonce TEXT NOT NULL,
    created_by TEXT,
    -- NULL = persistente (no expira por default). El tenant puede fijar caducidad.
    expires_at TIMESTAMPTZ,
    -- NULL = activo. Set != NULL → el resolver rechaza el token.
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qr_tokens_tenant ON qr_tokens(tenant_id);
CREATE INDEX idx_qr_tokens_entidad ON qr_tokens(entidad_id_dkg);
CREATE UNIQUE INDEX idx_qr_tokens_tenant_nonce ON qr_tokens(tenant_id, nonce);

ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_tokens_isolation" ON qr_tokens
    USING (tenant_id = current_setting('app.org_id', true))
    WITH CHECK (tenant_id = current_setting('app.org_id', true));
