-- ============================================================================
-- Migration: Add soft-delete lifecycle fields to dd_findings
-- Enables logical deletion (ABM baja) while preserving traceability links.
-- ============================================================================

ALTER TABLE public.dd_findings
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_dd_findings_project_active_updated
  ON public.dd_findings(project_id, is_active, updated_at DESC);

COMMENT ON COLUMN public.dd_findings.is_active IS
  'Soft-delete flag for ABM administration. false means archived/inactive.';
COMMENT ON COLUMN public.dd_findings.archived_at IS
  'Timestamp when the finding was archived via soft-delete.';
COMMENT ON COLUMN public.dd_findings.archived_by IS
  'User who archived the finding via soft-delete.';
COMMENT ON COLUMN public.dd_findings.archive_reason IS
  'Optional business rationale for archiving.';
