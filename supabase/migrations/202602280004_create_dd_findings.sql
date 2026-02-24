-- ============================================================================
-- Migration: dd_findings — Finding-Centric Architecture (Fase A, Step 1)
-- Creates the canonical findings table as source of truth for hallazgos.
-- Part of the Finding-Centric refactor described in BLUEPRINT_FINDING_CENTRIC_ARCHITECTURE.md
-- ============================================================================

-- 0. Helper: slugify function for external_ref generation
CREATE OR REPLACE FUNCTION public.slugify(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        translate(input,
          'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜçÇ',
          'aeiouunAEIOUUNaeiouAEIOUaeiouAEIOUaeiouAEIOUcC'
        ),
        '[^a-zA-Z0-9\s-]', '', 'g'  -- remove non-alphanumeric except spaces/hyphens
      ),
      '[\s]+', '_', 'g'  -- replace whitespace with underscore
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- 1. Create finding_status enum-like CHECK for clarity
-- Using CHECK constraints (not enum) for flexibility in future additions

-- 2. Create dd_findings table
CREATE TABLE public.dd_findings (
  -- Identity
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID NOT NULL REFERENCES public.dd_projects(id) ON DELETE CASCADE,
  external_ref                TEXT UNIQUE,  -- idempotency key: 'instance_id:phase:slug'

  -- Origin
  source_type                 TEXT NOT NULL CHECK (source_type IN (
                                'workflow_ai', 'manual', 'import', 'tool_societario', 'tool_ip'
                              )),
  source_workflow_instance_id UUID REFERENCES public.dd_workflow_instances(id) ON DELETE SET NULL,
  source_phase                TEXT,
  source_skill_key            TEXT,

  -- Classification
  area_code                   TEXT NOT NULL,
  title                       TEXT NOT NULL,
  description                 TEXT,

  -- 6 Dimensions (PRD section 7)
  severity                    TEXT NOT NULL CHECK (severity IN (
                                'critical', 'high', 'medium', 'low', 'informational'
                              )),
  probability                 TEXT NOT NULL CHECK (probability IN (
                                'certain', 'alta', 'probable', 'media', 'possible', 'baja', 'remote'
                              )),
  economic_impact_amount      NUMERIC,
  economic_impact_currency    TEXT DEFAULT 'EUR',
  economic_impact_type        TEXT CHECK (economic_impact_type IS NULL OR economic_impact_type IN (
                                'contingency', 'liability', 'loss', 'operational_cost'
                              )),
  timing                      TEXT CHECK (timing IS NULL OR timing IN ('blocking', 'post_closing')),
  mitigation_recommended      TEXT,
  verifiability               TEXT CHECK (verifiability IS NULL OR verifiability IN (
                                'verified', 'partially', 'not_verifiable'
                              )),

  -- Relevance Tier (Blueprint section 3)
  relevance_tier              INTEGER NOT NULL DEFAULT 3 CHECK (relevance_tier IN (1, 2, 3)),
  tier_override_by            UUID REFERENCES auth.users(id),
  tier_override_reason        TEXT,
  tier_auto_calculated        INTEGER,  -- original auto-calculated tier before any override

  -- Lifecycle state (Blueprint section 4)
  status                      TEXT NOT NULL DEFAULT 'identified' CHECK (status IN (
                                'identified', 'under_review', 'validated', 'contested',
                                'accepted', 'mitigated', 'reported', 'negotiated',
                                'resolved', 'dismissed'
                              )),

  -- HITL governance
  hitl_required               BOOLEAN DEFAULT false,
  hitl_decision               TEXT CHECK (hitl_decision IS NULL OR hitl_decision IN (
                                'approved', 'corrected', 'rejected'
                              )),
  hitl_reviewer_id            UUID REFERENCES auth.users(id),
  hitl_rationale              TEXT,
  hitl_decided_at             TIMESTAMPTZ,

  -- Scoring (computed at creation, refreshable)
  raw_score                   NUMERIC(5,2),
  weighted_score              NUMERIC(5,2),
  is_deal_breaker             BOOLEAN DEFAULT false,
  is_red_flag                 BOOLEAN DEFAULT false,

  -- Link to contingency (1:0..1 bidirectional)
  contingency_id              UUID UNIQUE REFERENCES public.dd_contingencies(id) ON DELETE SET NULL,

  -- Audit
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id),
  metadata                    JSONB DEFAULT '{}'::jsonb,

  -- Versioning (for re-assessments)
  version                     INTEGER NOT NULL DEFAULT 1,
  previous_version_id         UUID REFERENCES public.dd_findings(id) ON DELETE SET NULL
);

-- 3. Trigger for updated_at (reuse existing function)
CREATE TRIGGER set_dd_findings_updated_at
  BEFORE UPDATE ON public.dd_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Indices
-- Core lookups
CREATE INDEX idx_dd_findings_project
  ON public.dd_findings(project_id);
CREATE INDEX idx_dd_findings_project_area
  ON public.dd_findings(project_id, area_code);
CREATE INDEX idx_dd_findings_project_tier
  ON public.dd_findings(project_id, relevance_tier);
CREATE INDEX idx_dd_findings_project_status
  ON public.dd_findings(project_id, status);
CREATE INDEX idx_dd_findings_project_severity
  ON public.dd_findings(project_id, severity);

-- Origin lookups
CREATE INDEX idx_dd_findings_workflow_instance
  ON public.dd_findings(source_workflow_instance_id)
  WHERE source_workflow_instance_id IS NOT NULL;

-- Scoring/filtering
CREATE INDEX idx_dd_findings_deal_breakers
  ON public.dd_findings(project_id)
  WHERE is_deal_breaker = true;
CREATE INDEX idx_dd_findings_red_flags
  ON public.dd_findings(project_id)
  WHERE is_red_flag = true;
CREATE INDEX idx_dd_findings_contingency
  ON public.dd_findings(contingency_id)
  WHERE contingency_id IS NOT NULL;

-- Composite for common queries
CREATE INDEX idx_dd_findings_project_tier_status
  ON public.dd_findings(project_id, relevance_tier, status);

-- 5. Comment documentation
COMMENT ON TABLE public.dd_findings IS
  'Canonical source of truth for DD findings (hallazgos). Each finding represents one discrete legal observation discovered during due diligence analysis.';
COMMENT ON COLUMN public.dd_findings.external_ref IS
  'Idempotency key for upsert. Format: instance_id:phase:slugified_title';
COMMENT ON COLUMN public.dd_findings.relevance_tier IS
  '1=Decisorio (deal breaker/conditioner), 2=Gestion (requires follow-up), 3=Registro (documented only)';
COMMENT ON COLUMN public.dd_findings.tier_auto_calculated IS
  'The tier value as originally computed by the system, preserved even after manual override';
COMMENT ON COLUMN public.dd_findings.status IS
  'Lifecycle state: identified→under_review→validated→accepted/mitigated→reported→negotiated→resolved. Also: contested, dismissed.';
COMMENT ON COLUMN public.dd_findings.contingency_id IS
  'Bidirectional 1:0..1 link to dd_contingencies. Only populated for tier 1 and 2 findings.';

-- 6. Security: set search_path
ALTER FUNCTION public.slugify(TEXT) SET search_path = public;
