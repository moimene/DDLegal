-- ============================================================================
-- Migration: dd_report_findings — M:N linking between reports and findings
-- Part of the Finding-Centric refactor (Fase A, Step 3)
-- Pull-based: report engine creates links when compiling, not push from findings.
-- ============================================================================

CREATE TABLE public.dd_report_findings (
  report_id           UUID NOT NULL REFERENCES public.dd_reports(id) ON DELETE CASCADE,
  finding_id          UUID NOT NULL REFERENCES public.dd_findings(id) ON DELETE CASCADE,
  section_key         TEXT NOT NULL,      -- report section where finding appears
  display_order       INTEGER NOT NULL DEFAULT 0,
  inclusion_reason    TEXT NOT NULL CHECK (inclusion_reason IN (
                        'auto_tier',        -- included automatically by tier rules
                        'auto_area',        -- included as part of area report
                        'auto_executive',   -- included in executive summary
                        'auto_red_flag',    -- included because is_red_flag=true
                        'manual_add',       -- manually added by user
                        'manual_exclude'    -- manually excluded (soft-delete, row kept for audit)
                      )),
  is_excluded         BOOLEAN NOT NULL DEFAULT false,  -- for manual_exclude
  included_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  included_by         UUID REFERENCES auth.users(id),

  PRIMARY KEY (report_id, finding_id)
);

-- Indices
CREATE INDEX idx_dd_report_findings_report
  ON public.dd_report_findings(report_id);
CREATE INDEX idx_dd_report_findings_finding
  ON public.dd_report_findings(finding_id);
CREATE INDEX idx_dd_report_findings_report_section
  ON public.dd_report_findings(report_id, section_key, display_order);

-- Comments
COMMENT ON TABLE public.dd_report_findings IS
  'M:N relationship between reports and findings. Created by the report engine (pull-based) when compiling reports. Supports manual inclusion/exclusion with audit trail.';
COMMENT ON COLUMN public.dd_report_findings.inclusion_reason IS
  'Why this finding was included: auto_tier (by relevance tier rules), manual_add (user added), manual_exclude (user excluded but row kept for audit)';

-- Security: RLS enabled in 202602280008_rls_findings.sql
