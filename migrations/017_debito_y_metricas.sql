-- ============================================================
-- Migración 017: Débito real (reservar/liquidar/liberar) + instrumentación de métricas
-- Fecha: 2026-06-06
-- Bloque: F1.5 — Débito real / cobro de setup + observabilidad de peso/tiempo.
-- Descripción:
--   PARTE A — Esquema reservar/liquidar/liberar (opción C). `tenant_budget`
--     gana `retenido_usd`: el saldo se parte en DISPONIBLE (saldo_actual_usd) y
--     RETENIDO (retenido_usd). Al confirmar una ingesta se mueve el monto
--     cotizado de disponible→retenido (reservar); al completar se liquida a
--     costo real devolviendo el sobrante (liquidar); al fallar se devuelve la
--     reserva completa (liberar). Cierra el débito que F1 dejó sin invocar
--     (BudgetManager.debitar existía pero nadie lo llamaba).
--   PARTE B — Tamaño de documento. `documents` gana `size_bytes` (peso del
--     archivo original) y `result_bytes` (peso del resultado almacenado). El
--     super-admin expone el agregado por org (antes null). Aditivas, no rompen
--     filas existentes.
-- Ambas alteran tablas existentes (002 documents, 008 tenant_budget); NO crean
-- tablas nuevas. Multi-tenant strict se conserva (RLS de 002/008 intacta).
-- ============================================================

-- ── PARTE A — saldo retenido (reservar/liquidar/liberar) ─────────────────────
ALTER TABLE tenant_budget
    ADD COLUMN IF NOT EXISTS retenido_usd NUMERIC(12, 4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN tenant_budget.retenido_usd IS
    'Monto reservado (retenido) por ingestas confirmadas y aún no liquidadas. '
    'saldo_actual_usd = disponible; retenido_usd = comprometido. F1.5.';

-- ── PARTE B — tamaño de documento (peso) ─────────────────────────────────────
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS result_bytes BIGINT;

COMMENT ON COLUMN documents.size_bytes IS
    'Peso en bytes del archivo original ingerido (instrumentación F1.5). '
    'NULL = documento previo a la instrumentación.';
COMMENT ON COLUMN documents.result_bytes IS
    'Peso en bytes del resultado almacenado (texto/markdown convertido). F1.5.';
