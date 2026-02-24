-- Migration: Add depends_on column to dd_finding_objectives
-- Part of Worker Architecture v1.0 — F.3: FO Dependencies

-- Add depends_on column for FO dependency tracking
ALTER TABLE dd_finding_objectives
  ADD COLUMN IF NOT EXISTS depends_on TEXT[] DEFAULT '{}';

COMMENT ON COLUMN dd_finding_objectives.depends_on IS
  'Array of objective_keys this FO depends on. These must be evaluated first.';

-- Add index for dependency lookups
CREATE INDEX IF NOT EXISTS idx_fo_depends_on
  ON dd_finding_objectives USING GIN(depends_on);

-- Seed some example dependencies (based on WORKER_ARCHITECTURE_v1.md examples)
-- FO-MERC dependencies
UPDATE dd_finding_objectives
SET depends_on = ARRAY['FO-MERC-001']
WHERE objective_key = 'FO-MERC-002';

UPDATE dd_finding_objectives
SET depends_on = ARRAY['FO-MERC-002']
WHERE objective_key = 'FO-MERC-003';

UPDATE dd_finding_objectives
SET depends_on = ARRAY['FO-MERC-003']
WHERE objective_key = 'FO-MERC-004';

-- FO-CONT dependencies
UPDATE dd_finding_objectives
SET depends_on = ARRAY['FO-CONT-001']
WHERE objective_key IN ('FO-CONT-002', 'FO-CONT-003', 'FO-CONT-004');

-- FO-LAB dependencies
UPDATE dd_finding_objectives
SET depends_on = ARRAY['FO-LAB-001']
WHERE objective_key = 'FO-LAB-002';

UPDATE dd_finding_objectives
SET depends_on = ARRAY['FO-LAB-002']
WHERE objective_key = 'FO-LAB-003';

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Migration 202602280021: Added depends_on column and seeded dependencies';
END $$;
