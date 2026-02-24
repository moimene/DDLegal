-- Migration 10: Expand CHECK constraints on dd_findings
-- Adds values produced by the workflow engine and dual-write layer.

-- Expand source_type to include workflow engine values
ALTER TABLE dd_findings DROP CONSTRAINT dd_findings_source_type_check;
ALTER TABLE dd_findings ADD CONSTRAINT dd_findings_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'workflow_ai', 'manual', 'import',
    'tool_societario', 'tool_ip',
    'workflow_execution', 'manual_entry', 'ai_analysis',
    'document_review', 'registry_scrape', 'backfill'
  ]));

-- Expand timing to include pre-closing and other workflow values
ALTER TABLE dd_findings DROP CONSTRAINT dd_findings_timing_check;
ALTER TABLE dd_findings ADD CONSTRAINT dd_findings_timing_check
  CHECK (timing IS NULL OR timing = ANY (ARRAY[
    'blocking', 'post_closing', 'pre_closing', 'pre-close', 'post-close',
    'ongoing', 'immediate'
  ]));

-- Expand verifiability to include workflow output values
ALTER TABLE dd_findings DROP CONSTRAINT dd_findings_verifiability_check;
ALTER TABLE dd_findings ADD CONSTRAINT dd_findings_verifiability_check
  CHECK (verifiability IS NULL OR verifiability = ANY (ARRAY[
    'verified', 'partially', 'not_verifiable',
    'documentable', 'verifiable', 'unverifiable'
  ]));

-- Expand economic_impact_type to include workflow values
ALTER TABLE dd_findings DROP CONSTRAINT dd_findings_economic_impact_type_check;
ALTER TABLE dd_findings ADD CONSTRAINT dd_findings_economic_impact_type_check
  CHECK (economic_impact_type IS NULL OR economic_impact_type = ANY (ARRAY[
    'contingency', 'liability', 'loss', 'operational_cost',
    'direct', 'indirect', 'reputational'
  ]));
