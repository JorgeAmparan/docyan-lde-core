-- ============================================================
-- Migración 018: RPC atómicas de débito (reservar / liquidar / liberar)
-- Fecha: 2026-06-06
-- Bloque: F1.5 (cierre) — el saldo es dinero: cero read-modify-write.
-- Descripción:
--   El esquema reservar/liquidar/liberar (017) se ejecutaba como read-modify-write
--   desde la app, con una condición de carrera real sobre el saldo (dos reservas
--   concurrentes del mismo tenant podían sobre-vender el disponible). Estas tres
--   funciones convierten cada operación en UNA sentencia UPDATE indivisible bajo
--   lock de fila de Postgres:
--     · budget_reservar: mueve disponible→retenido SOLO si `saldo_actual_usd >= monto`.
--       La guarda se re-evalúa sobre la fila ya bloqueada (EvalPlanQual), así que
--       dos reservas concurrentes NUNCA dejan el disponible en negativo (no oversell).
--     · budget_liquidar / budget_liberar: aritmética atómica sobre la fila bloqueada,
--       sin lectura previa en la app → no hay lost update bajo concurrencia.
--   La app (SupabaseBudgetStore) llama estas RPC vía PostgREST; ya no escribe el
--   saldo con un UPDATE plano. Multi-tenant: operan por `tenant_id` (clave única 008).
--   Nota plpgsql: las columnas de salida llevan prefijo `out_` para NO colisionar
--   (shadowing) con los nombres de columna de tenant_budget dentro del UPDATE.
-- ============================================================

-- ── reservar: atómico y con guarda de disponible ─────────────────────────────
CREATE OR REPLACE FUNCTION budget_reservar(p_tenant TEXT, p_monto NUMERIC)
RETURNS TABLE(out_ok BOOLEAN, out_disponible NUMERIC, out_retenido NUMERIC, out_falta NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE
    v_disp NUMERIC;
    v_ret  NUMERIC;
BEGIN
    -- Un solo UPDATE: mueve disponible→retenido si y solo si alcanza. Bajo
    -- concurrencia, el segundo escritor re-evalúa la guarda sobre la fila ya
    -- bloqueada (no puede sobre-vender).
    UPDATE tenant_budget
       SET saldo_actual_usd = saldo_actual_usd - p_monto,
           retenido_usd     = retenido_usd + p_monto
     WHERE tenant_id = p_tenant
       AND saldo_actual_usd >= p_monto
    RETURNING saldo_actual_usd, retenido_usd INTO v_disp, v_ret;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_disp, v_ret, 0::NUMERIC;
        RETURN;
    END IF;

    -- No alcanzó (o no existe): reporta el faltante (informativo).
    SELECT tb.saldo_actual_usd, tb.retenido_usd INTO v_disp, v_ret
      FROM tenant_budget tb WHERE tb.tenant_id = p_tenant;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant_budget inexistente para %', p_tenant
            USING ERRCODE = 'no_data_found';
    END IF;
    RETURN QUERY SELECT FALSE, v_disp, v_ret, ROUND(p_monto - v_disp, 4);
END;
$$;

-- ── liquidar: retenido→consumo real, sobrante de vuelta a disponible ──────────
CREATE OR REPLACE FUNCTION budget_liquidar(p_tenant TEXT, p_reserva NUMERIC, p_real NUMERIC)
RETURNS TABLE(out_disponible NUMERIC, out_retenido NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE
    v_disp NUMERIC;
    v_ret  NUMERIC;
BEGIN
    UPDATE tenant_budget
       SET retenido_usd     = GREATEST(0, retenido_usd - p_reserva),
           saldo_actual_usd = saldo_actual_usd + (p_reserva - p_real)
     WHERE tenant_id = p_tenant
    RETURNING saldo_actual_usd, retenido_usd INTO v_disp, v_ret;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant_budget inexistente para %', p_tenant
            USING ERRCODE = 'no_data_found';
    END IF;
    RETURN QUERY SELECT v_disp, v_ret;
END;
$$;

-- ── liberar: reserva completa de vuelta a disponible ──────────────────────────
CREATE OR REPLACE FUNCTION budget_liberar(p_tenant TEXT, p_reserva NUMERIC)
RETURNS TABLE(out_disponible NUMERIC, out_retenido NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE
    v_disp NUMERIC;
    v_ret  NUMERIC;
BEGIN
    UPDATE tenant_budget
       SET retenido_usd     = GREATEST(0, retenido_usd - p_reserva),
           saldo_actual_usd = saldo_actual_usd + p_reserva
     WHERE tenant_id = p_tenant
    RETURNING saldo_actual_usd, retenido_usd INTO v_disp, v_ret;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'tenant_budget inexistente para %', p_tenant
            USING ERRCODE = 'no_data_found';
    END IF;
    RETURN QUERY SELECT v_disp, v_ret;
END;
$$;
