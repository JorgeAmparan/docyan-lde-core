-- ============================================================
-- Migración 020: `orgs` de primer nivel + invitaciones (B13)
-- Fecha: 2026-06-08
-- Descripción: Habilita el ciclo de uso real del cliente (Sprint B13).
--   1) Formaliza `orgs` como entidad de PRIMER NIVEL. Hasta F2 la org se derivaba
--      de `users.org_id` + `org_billing` (registro de plataforma). Este sprint le
--      da identidad propia: nombre, banda de mercado, idioma, estado de ciclo de
--      vida, plan, límites freemium (3 docs / 30 días), criticidad del segmento
--      (decisión #15, fase 2) y banderas de onboarding. Se hace BACKFILL sin
--      pérdida desde `users.org_id` + `org_billing`.
--   2) `invitations`: un admin de org invita a otros usuarios por correo. Token
--      (hash), email destino, rol, vencimiento, estado. El invitado abre el enlace,
--      establece contraseña y queda como usuario de esa org con su rol.
--
--   Aislamiento: ambas tablas son operadas por el backend con SUPABASE_SERVICE_KEY
--   (bypassa RLS, igual que users/org_billing). Se ENABLE RLS con policy de
--   aislamiento por org para que cualquier rol no-service quede confinado a su org.
-- ============================================================

-- ── (1) orgs — entidad de primer nivel ───────────────────────────────────────
CREATE TABLE orgs (
    id TEXT PRIMARY KEY,                 -- org_id (sha256(email primer admin)[:16])
    nombre TEXT,                         -- nombre legible (display_name)
    -- Banda de mercado heredada del onboarding (geolocalización vive en la capa
    -- pública, sprint posterior; aquí solo se consume). Default razonable: A / es.
    banda_mercado TEXT NOT NULL DEFAULT 'A',
    idioma TEXT NOT NULL DEFAULT 'es',
    -- Ciclo de vida de la org (alineado con org_billing.lifecycle_status).
    lifecycle_status TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN ('active', 'grace', 'suspended', 'cancelled')),
    -- Plan: freemium (autoservicio) | piloto (canje de código) | tiers pagados.
    plan TEXT NOT NULL DEFAULT 'freemium',
    -- Límite de DOCUMENTOS VIVOS del plan. NULL = ilimitado. Freemium = 3.
    doc_limit INTEGER,
    -- Ventana freemium (30 días). NULL fuera de freemium.
    freemium_inicio TIMESTAMPTZ,
    freemium_expira TIMESTAMPTZ,
    -- Criticidad del segmento (decisión #15) — se fija en la FASE 2 del onboarding.
    -- NULL hasta que el cliente activa/elige plan (o lo infiere el pipeline). Los 5
    -- niveles canónicos del modelo comercial fijan el umbral de confianza del caché
    -- (seguridad ≥0.95 · regulatorio ≥0.90 · calidad ≥0.85 · operacional ≥0.75 ·
    -- informativa ≥0.60). Se aceptan también alta/media/baja por compatibilidad.
    criticidad_segmento TEXT
        CHECK (criticidad_segmento IS NULL OR criticidad_segmento IN (
            'seguridad', 'regulatorio', 'calidad', 'operacional', 'informativa',
            'alta', 'media', 'baja'
        )),
    -- Bandera: la fase 2 (config de plan + criticidad) está completa.
    fase2_completada BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;  -- platform/service-managed.
CREATE POLICY "orgs_self_isolation" ON orgs
    USING (id = current_setting('app.org_id', true))
    WITH CHECK (id = current_setting('app.org_id', true));

-- ── BACKFILL sin pérdida desde users.org_id + org_billing ────────────────────
-- Una fila por cada org existente (distinct users.org_id ∪ org_billing.org_id).
-- nombre/plan/lifecycle se toman de org_billing si existe. created_at = alta del
-- primer usuario de la org (o now si no hay users). Las orgs previas quedan SIN
-- límite freemium (doc_limit NULL = ilimitado) para no romper cuentas vivas: el
-- límite de 3 docs aplica solo a las cuentas freemium creadas a partir de B13.
-- `src` produce EXACTAMENTE una fila por org (orgs con usuarios + orgs que solo
-- existen en org_billing), evitando duplicados del UNION → sin GROUP BY externo.
INSERT INTO orgs (id, nombre, plan, lifecycle_status, doc_limit, created_at)
SELECT
    src.org_id,
    COALESCE(b.display_name, src.org_id)                AS nombre,
    COALESCE(b.plan, 'piloto')                          AS plan,
    COALESCE(b.lifecycle_status, 'active')              AS lifecycle_status,
    NULL::INTEGER                                       AS doc_limit,
    COALESCE(src.first_user_at, b.created_at, NOW())    AS created_at
FROM (
    SELECT org_id, MIN(created_at) AS first_user_at
    FROM users
    GROUP BY org_id
    UNION
    SELECT org_id, NULL::TIMESTAMPTZ AS first_user_at
    FROM org_billing
    WHERE org_id NOT IN (SELECT DISTINCT org_id FROM users)
) src
LEFT JOIN org_billing b ON b.org_id = src.org_id
ON CONFLICT (id) DO NOTHING;

-- ── (2) invitations — invitación de usuarios por correo ──────────────────────
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,                 -- email destino de la invitación
    role TEXT NOT NULL DEFAULT 'viewer'  -- rol/permiso con que entrará el invitado
        CHECK (role IN ('admin', 'editor', 'viewer')),
    token_hash TEXT NOT NULL,            -- sha256 del token (el crudo va solo en el correo)
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by TEXT,                     -- user_id/email del admin que invitó
    accepted_user_id TEXT,               -- user creado al aceptar
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_org_id ON invitations(org_id);
CREATE INDEX idx_invitations_email ON invitations(email);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_org_isolation" ON invitations
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));
