-- ============================================================
-- Migración 021: Cupo de ingestas por tier (F3 §C — Modelo Comercial v1.1 §2.3)
-- Fecha: 2026-06-10
-- Bloque: F3 (Sitio Público v2)
-- Descripción:
--   La página de precios promete "ingestas incluidas" por plan (Esencial 10+3/mes ·
--   Profesional 30+10/mes · Enterprise negociado). Hasta hoy el cotizador cobraba la
--   PRIMERA ingesta con la fórmula de setup — incoherente con esa promesa. Esta
--   migración añade el CUPO de ingestas, distinto de:
--     · `orgs.doc_limit` (mig 020) — tope de DOCUMENTOS VIVOS del grafo.
--     · `tenant_budget.saldo_actual_usd` (mig 008) — USD prepagado de CÓMPUTO.
--   El cupo gobierna el PRECIO DE SETUP comercial: dentro de cupo → setup $0
--   ("incluido en tu plan"); agotado → fórmula MAX($15, costo×25)×factor.
--
--   Freemium NO tiene fila de cupo (opera con su saldo de cortesía, sin cambio).
--   Enterprise se marca `enterprise_configurable` (cupo negociado, editable a mano).
--
--   Idempotencia del decremento: un `org_ingest_quota_ledger` por `job_id`. Reintentar
--   la confirmación del mismo job NO vuelve a descontar cupo (igual criterio que el
--   débito de saldo F1.5, que es idempotente por SHA-256).
--
--   Aislamiento: operadas por el backend con SUPABASE_SERVICE_KEY (bypassa RLS, igual
--   que tenant_budget/orgs). RLS habilitado con policy de aislamiento por org.
--   Aditiva e idempotente: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- ============================================================

-- ── Cupo de ingestas por org ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_ingest_quota (
    org_id TEXT PRIMARY KEY,
    -- Cupo inicial del plan (Esencial 10 · Profesional 30). También es el TECHO de
    -- acumulación: la reposición mensual nunca lleva el restante por encima de él.
    cupo_inicial INTEGER NOT NULL DEFAULT 0,
    -- Reposición recurrente cada mes (Esencial 3 · Profesional 10 · Enterprise neg.).
    cupo_recurrente_mensual INTEGER NOT NULL DEFAULT 0,
    -- Cupo de ingestas incluidas que quedan disponibles ahora mismo.
    cupo_restante INTEGER NOT NULL DEFAULT 0,
    -- Enterprise: cupo negociado, editable a mano (no sembrado por tabla de planes).
    enterprise_configurable BOOLEAN NOT NULL DEFAULT FALSE,
    ultima_reposicion TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (cupo_restante >= 0)
);
ALTER TABLE org_ingest_quota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quota_self_isolation" ON org_ingest_quota;
CREATE POLICY "quota_self_isolation" ON org_ingest_quota
    USING (org_id = current_setting('app.org_id', true))
    WITH CHECK (org_id = current_setting('app.org_id', true));

-- ── Ledger de decrementos (idempotencia por job_id) ──────────────────────────
CREATE TABLE IF NOT EXISTS org_ingest_quota_ledger (
    job_id TEXT PRIMARY KEY,            -- un decremento como mucho por job de ingesta
    org_id TEXT NOT NULL,
    decremented_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quota_ledger_org ON org_ingest_quota_ledger(org_id);

-- ── RPC: decrementar cupo al confirmar una ingesta DENTRO de cupo ─────────────
-- Atómico e idempotente. El ledger garantiza un decremento como mucho por job:
--   · primer confirm del job  → inserta ledger + descuenta 1 (si restante > 0).
--   · reintento del mismo job → ON CONFLICT no inserta → NO descuenta (idempotente).
-- Devuelve si descontó y el restante resultante.
CREATE OR REPLACE FUNCTION cupo_decrementar(p_org TEXT, p_job TEXT)
RETURNS TABLE(out_decremented BOOLEAN, out_restante INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
    v_rest INTEGER;
BEGIN
    INSERT INTO org_ingest_quota_ledger(job_id, org_id)
        VALUES (p_job, p_org)
        ON CONFLICT (job_id) DO NOTHING;

    IF NOT FOUND THEN
        -- Este job ya descontó antes: idempotente, no toca el cupo.
        SELECT cupo_restante INTO v_rest FROM org_ingest_quota WHERE org_id = p_org;
        RETURN QUERY SELECT FALSE, COALESCE(v_rest, 0);
        RETURN;
    END IF;

    UPDATE org_ingest_quota
       SET cupo_restante = cupo_restante - 1, updated_at = NOW()
     WHERE org_id = p_org AND cupo_restante > 0
    RETURNING cupo_restante INTO v_rest;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_rest;
    ELSE
        -- Sin fila de cupo o cupo ya en 0: no hay nada que descontar.
        SELECT cupo_restante INTO v_rest FROM org_ingest_quota WHERE org_id = p_org;
        RETURN QUERY SELECT FALSE, COALESCE(v_rest, 0);
    END IF;
END;
$$;

-- ── RPC: reposición mensual del cupo recurrente (scheduler, día 1) ────────────
-- Suma el recurrente al restante, sin pasar del techo (cupo_inicial). Idempotente
-- en el sentido comercial: re-ejecutar el mismo mes no acumula por encima del techo.
-- Devuelve cuántas orgs se repusieron.
CREATE OR REPLACE FUNCTION cupo_reponer_mensual()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE org_ingest_quota
       SET cupo_restante = LEAST(cupo_restante + cupo_recurrente_mensual, cupo_inicial),
           ultima_reposicion = NOW(),
           updated_at = NOW()
     WHERE cupo_recurrente_mensual > 0;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
