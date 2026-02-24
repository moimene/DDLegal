-- ============================================================================
-- Migration: Add summary column to dd_findings
-- AI-generated synthetic summary (200 chars) via Harvey
-- ============================================================================

-- Add summary column
ALTER TABLE public.dd_findings
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add index for findings without summary (for batch processing)
CREATE INDEX IF NOT EXISTS idx_dd_findings_no_summary
  ON public.dd_findings(created_at)
  WHERE summary IS NULL;

-- Comment
COMMENT ON COLUMN public.dd_findings.summary IS
  'AI-generated synthetic summary (~200 chars) explaining the finding. Generated via Harvey on creation or batch.';
