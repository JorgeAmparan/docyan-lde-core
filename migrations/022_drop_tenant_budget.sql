-- Migración 022: Retiro del saldo prepagado (modelo comercial v2.1)
--
-- DOCYAN LDE™ by XCID.
--
-- El modelo comercial vigente (cotizador.md: cupo + excedente cotizado, SIN saldo
-- prepagado) deja obsoleta la tabla `tenant_budget` (008 + retenido_usd de 017) y
-- las RPC atómicas de reserva/liquidación/liberación (018). El gate de ingesta es
-- ahora cupo + cotización + confirmación explícita; el cobro del excedente va al
-- método de pago al confirmar (manual hasta que se cablee Stripe, B9.1).
--
-- Destructiva pero idempotente (IF EXISTS): elimina el wallet prepagado y sus RPC.
-- El cupo de ingestas vive aparte (021_cupo_ingestas) y NO se toca.

-- RPC atómicas del wallet (018).
DROP FUNCTION IF EXISTS budget_reservar(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS budget_liquidar(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS budget_liberar(TEXT, NUMERIC);

-- La tabla arrastra su índice único, su policy RLS y su trigger al DROP ... CASCADE.
DROP TABLE IF EXISTS tenant_budget CASCADE;

-- La función del trigger de updated_at queda huérfana tras el DROP de la tabla.
DROP FUNCTION IF EXISTS update_tenant_budget_updated_at();
