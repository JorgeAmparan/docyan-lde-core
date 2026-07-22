-- ============================================================
-- Migración 025: Política de retención de la familia F10 (Eventos Dirigidos)
-- Fecha: 2026-07-20
-- Bloque: ED-1 (Eventos Dirigidos)
-- Descripción:
--   La familia FAT F10 (eventos dirigidos: transiciones de ciclo de vida de
--   alertas y —en ED-2— solicitudes) se añadió al enum `FamiliaFAT` y a
--   `RETENCION_ANIOS` (fuente de verdad en código). Esta migración replica la
--   política en la tabla `fat_retention_policy` (mig 013) para mantener ambas
--   fuentes coherentes (la rutina de retención puede leer de cualquiera).
--   Retención 3 años, alineada con alertas (F6). Idempotente por familia.
-- ============================================================

INSERT INTO fat_retention_policy (familia, anios_retencion, descripcion) VALUES
    ('F10', 3, 'Eventos dirigidos (alertas + solicitudes) — transiciones de ciclo de vida')
ON CONFLICT (familia) DO NOTHING;
