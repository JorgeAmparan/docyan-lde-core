-- ============================================================
-- Migración 016: Super-Admin de Plataforma (F2 backend)
-- Fecha: 2026-06-06
-- Descripción: Identidad y superficies del rol `platform_admin` (consola del
--   fundador). Modelo de seguridad cerrado (Sprint F2):
--     · `platform_admin` vive en tabla PROPIA, FUERA del RLS de tenant.
--     · metadata SÍ / contenido NO: estas tablas guardan metadata operativa y de
--       negocio, NUNCA contenido de documentos, texto de consultas ni grafos.
--     · toda acción mutante de plataforma se audita en el FAT (audit_trail).
--   Las tablas platform-only NO llevan policy de tenant: el backend las opera con
--   SUPABASE_SERVICE_KEY (bypassa RLS, igual que users/api_keys en 001/007). Se
--   ENABLE RLS sin policy permisiva → denegado por defecto a cualquier rol no-service.
-- ============================================================

-- ── Identidad del fundador (fuera de la jerarquía de tenant) ─────────────────
CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_platform_admins_email ON platform_admins(email);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;  -- sin policy: solo service_role.

-- ── Registro de negocio por org (plan + ciclo de vida + nombre legible) ──────
-- No existe tabla `orgs`: las orgs se derivan de `users.org_id`. Esta tabla es el
-- registro de PLATAFORMA sobre cada org (lo que el fundador administra). Orgs sin
-- fila aquí se tratan como `active`/plan por defecto al listar (LEFT JOIN).
CREATE TABLE org_billing (
    org_id TEXT PRIMARY KEY,
    display_name TEXT,
    plan TEXT NOT NULL DEFAULT 'piloto',
    -- Ciclo de vida de impago (base; la automatización gracia/suspensión es F4).
    lifecycle_status TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN ('active', 'grace', 'suspended', 'cancelled')),
    next_billing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE org_billing ENABLE ROW LEVEL SECURITY;  -- platform-managed; service_role.

-- ── (B) Códigos de acceso de piloto ─────────────────────────────────────────
CREATE TABLE access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'piloto' CHECK (tipo IN ('prueba', 'piloto')),
    cuota_documentos INTEGER NOT NULL DEFAULT 0,
    cuota_saldo_usd NUMERIC(12, 4) NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'used', 'expired', 'revoked')),
    org_generada TEXT,            -- org_id provisionada al canjear (si ya se usó)
    created_by TEXT,              -- email/id del platform_admin que lo generó
    created_at TIMESTAMPTZ DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_access_codes_code ON access_codes(code);
CREATE INDEX idx_access_codes_status ON access_codes(status);
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;  -- platform-managed; service_role.

-- ── (C) Registro de ingresos manuales ───────────────────────────────────────
CREATE TABLE manual_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    monto NUMERIC(12, 2) NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'MXN' CHECK (moneda IN ('MXN', 'USD')),
    concepto TEXT NOT NULL DEFAULT 'suscripcion'
        CHECK (concepto IN ('suscripcion', 'setup', 'recarga')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nota TEXT,
    registrado_por TEXT,          -- platform_admin que lo registró
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_manual_payments_org_id ON manual_payments(org_id);
CREATE INDEX idx_manual_payments_fecha ON manual_payments(fecha);
ALTER TABLE manual_payments ENABLE ROW LEVEL SECURITY;  -- platform-managed; service_role.

-- ── (D) Base de chat de soporte ─────────────────────────────────────────────
CREATE TABLE support_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    user_id TEXT,
    pantalla_origen TEXT,         -- contexto: pantalla desde la que se abrió
    estado TEXT NOT NULL DEFAULT 'abierto'
        CHECK (estado IN ('abierto', 'respondido', 'cerrado')),
    -- Gancho de auto-respuesta futura (F3): un hilo marcado como auto-respondible
    -- podrá ser atendido por un bot cuando haya masa crítica. NO se implementa el bot.
    auto_respondible BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_support_threads_org_id ON support_threads(org_id);
CREATE INDEX idx_support_threads_estado ON support_threads(estado);
ALTER TABLE support_threads ENABLE ROW LEVEL SECURITY;
-- El tenant ve solo sus hilos; el platform_admin accede vía service_role (bandeja).
CREATE POLICY "support_threads_org_isolation" ON support_threads
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));

CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
    autor_tipo TEXT NOT NULL CHECK (autor_tipo IN ('usuario', 'founder')),
    autor_id TEXT,
    cuerpo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_support_messages_thread_id ON support_messages(thread_id);
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_messages_thread_isolation" ON support_messages
    USING (thread_id IN (
        SELECT id FROM support_threads
        WHERE org_id = current_setting('app.org_id', true)
    ))
    WITH CHECK (thread_id IN (
        SELECT id FROM support_threads
        WHERE org_id = current_setting('app.org_id', true)
    ));
