-- ============================================================
-- Migración 019: Nota interna en códigos de acceso (F2 frontend)
-- Fecha: 2026-06-06
-- Descripción: El generador de códigos de la Consola del Fundador captura una
--   NOTA INTERNA opcional (ej. "piloto Lab Saltillo — referido por Delta Norte").
--   Es metadata administrativa del fundador, NUNCA contenido de tenant. Aditiva.
-- ============================================================

ALTER TABLE access_codes
    ADD COLUMN IF NOT EXISTS nota TEXT;

COMMENT ON COLUMN access_codes.nota IS
    'Nota interna del platform_admin al generar el código (metadata, no contenido). F2.';
