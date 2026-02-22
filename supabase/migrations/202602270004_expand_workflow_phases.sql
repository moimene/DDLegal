-- ============================================================
-- Expand dd_workflow_phase enum: 5 → 7 values (6 active + 1 legacy)
-- ============================================================
-- Adds 'informe' and 'propuesta_transaccional' after 'valoracion'.
-- Keeps 'tratamiento' for backward compatibility with existing
-- seed data (202602270003).
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block, so this migration must NOT be wrapped in BEGIN/COMMIT.
--
-- Date: 2026-02-27
-- ============================================================

-- 1. Add new enum values
ALTER TYPE dd_workflow_phase ADD VALUE IF NOT EXISTS 'informe' AFTER 'valoracion';
ALTER TYPE dd_workflow_phase ADD VALUE IF NOT EXISTS 'propuesta_transaccional' AFTER 'informe';

-- 2. Update the default phase_status on dd_workflow_instances to
--    include the two new phases. Existing rows are unaffected;
--    only new rows get the expanded default.
ALTER TABLE dd_workflow_instances
  ALTER COLUMN phase_status
  SET DEFAULT '{"obtencion":"pending","gestion":"pending","analisis":"pending","valoracion":"pending","informe":"pending","propuesta_transaccional":"pending"}'::JSONB;
