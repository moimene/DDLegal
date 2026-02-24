-- Migration: Add configurable evidence thresholds
-- Task 10 of 12: G-11 - Configurable evidence thresholds per area/FO

BEGIN;

-- Add threshold columns to dd_finding_objectives
ALTER TABLE dd_finding_objectives
ADD COLUMN IF NOT EXISTS evidence_threshold NUMERIC(3,2) DEFAULT 0.60,
ADD COLUMN IF NOT EXISTS min_evidence_count INTEGER DEFAULT 1;

-- Add threshold columns to dd_scoring_config for area-level defaults
ALTER TABLE dd_scoring_config
ADD COLUMN IF NOT EXISTS default_evidence_threshold NUMERIC(3,2) DEFAULT 0.60;

-- Create RPC to get effective threshold for an FO
CREATE OR REPLACE FUNCTION get_evidence_threshold(
  p_objective_key TEXT,
  p_area_code TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_threshold NUMERIC;
BEGIN
  -- First try FO-specific threshold
  SELECT evidence_threshold INTO v_threshold
  FROM dd_finding_objectives
  WHERE objective_key = p_objective_key
    AND evidence_threshold IS NOT NULL;

  IF v_threshold IS NOT NULL THEN
    RETURN v_threshold;
  END IF;

  -- Fall back to area-level default
  IF p_area_code IS NOT NULL THEN
    SELECT default_evidence_threshold INTO v_threshold
    FROM dd_scoring_config
    WHERE config_key = 'area_' || p_area_code
      AND default_evidence_threshold IS NOT NULL
    LIMIT 1;

    IF v_threshold IS NOT NULL THEN
      RETURN v_threshold;
    END IF;
  END IF;

  -- Default fallback
  RETURN 0.60;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing FOs with area-appropriate thresholds
-- Critical areas get higher thresholds
UPDATE dd_finding_objectives
SET evidence_threshold = 0.70
WHERE objective_key LIKE 'FO-MERC-CA-%'
  AND evidence_threshold = 0.60;

UPDATE dd_finding_objectives
SET evidence_threshold = 0.65
WHERE objective_key LIKE 'FO-LIT-%'
  AND evidence_threshold = 0.60;

COMMIT;
