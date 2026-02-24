-- ============================================================
-- Fase D: Backfill dd_findings from existing data sources
-- 1. dd_contingencies → dd_findings (with bidirectional FK)
-- 2. Workflow instance metadata findings → dd_findings
-- ============================================================

-- ---------- 1. Backfill from dd_contingencies ----------

INSERT INTO dd_findings (
  project_id, external_ref, source_type, area_code,
  title, description, severity, probability,
  economic_impact_amount, economic_impact_currency, economic_impact_type,
  mitigation_recommended,
  relevance_tier, tier_auto_calculated,
  status, raw_score, weighted_score,
  is_deal_breaker, is_red_flag,
  contingency_id,
  hitl_required,
  created_at,
  metadata
)
SELECT
  c.project_id,
  'backfill:contingency:' || c.id AS external_ref,
  'import' AS source_type,
  COALESCE(a.code, 'GENERAL') AS area_code,
  c.title,
  c.description,
  c.severity,
  c.probability,
  CASE WHEN c.estimated_amount IS NOT NULL THEN c.estimated_amount::numeric ELSE NULL END,
  'EUR',
  CASE
    WHEN c.severity IN ('critical', 'high') THEN 'liability'
    ELSE NULL
  END,
  c.recommendation AS mitigation_recommended,
  CASE
    WHEN c.severity = 'critical' THEN 1
    WHEN c.severity = 'high' AND c.probability IN ('certain', 'alta', 'probable') THEN 1
    WHEN c.severity = 'high' THEN 2
    WHEN c.severity = 'medium' AND c.estimated_amount IS NOT NULL AND c.estimated_amount::numeric > 0 THEN 2
    ELSE 3
  END AS relevance_tier,
  CASE
    WHEN c.severity = 'critical' THEN 1
    WHEN c.severity = 'high' AND c.probability IN ('certain', 'alta', 'probable') THEN 1
    WHEN c.severity = 'high' THEN 2
    WHEN c.severity = 'medium' AND c.estimated_amount IS NOT NULL AND c.estimated_amount::numeric > 0 THEN 2
    ELSE 3
  END AS tier_auto_calculated,
  CASE c.status
    WHEN 'identified' THEN 'identified'
    WHEN 'confirmed' THEN 'validated'
    WHEN 'accepted' THEN 'accepted'
    WHEN 'mitigated' THEN 'mitigated'
    WHEN 'resolved' THEN 'resolved'
    ELSE 'identified'
  END AS status,
  COALESCE(c.risk_score::numeric, 0) AS raw_score,
  c.risk_score::numeric AS weighted_score,
  COALESCE(c.is_deal_breaker, false),
  c.severity IN ('critical', 'high') AS is_red_flag,
  c.id AS contingency_id,
  c.severity IN ('critical', 'high') AS hitl_required,
  c.created_at,
  jsonb_build_object(
    'backfill_source', 'dd_contingencies',
    'backfill_date', now()::text,
    'original_go_no_go', c.go_no_go,
    'original_status', c.status
  )
FROM dd_contingencies c
LEFT JOIN dd_areas a ON c.area_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM dd_findings f
  WHERE f.external_ref = 'backfill:contingency:' || c.id
);

-- Update dd_contingencies with finding_id FK (bidirectional link)
UPDATE dd_contingencies c
SET finding_id = f.id
FROM dd_findings f
WHERE f.external_ref = 'backfill:contingency:' || c.id
  AND c.finding_id IS NULL;

-- ---------- 2. Backfill from workflow instance metadata ----------

INSERT INTO dd_findings (
  project_id, external_ref, source_type,
  source_workflow_instance_id, source_phase,
  area_code, title, description,
  severity, probability, timing,
  mitigation_recommended,
  relevance_tier, tier_auto_calculated,
  status, raw_score,
  is_deal_breaker, is_red_flag,
  hitl_required,
  metadata
)
SELECT
  wi.project_id,
  wi.id || ':' || replace(key, 'phase_results_', '') || ':' ||
    left(lower(regexp_replace(f.elem->>'title', '[^a-z0-9]+', '-', 'gi')), 64) AS external_ref,
  'workflow_ai' AS source_type,
  wi.id AS source_workflow_instance_id,
  replace(key, 'phase_results_', '') AS source_phase,
  'GENERAL' AS area_code,
  f.elem->>'title' AS title,
  f.elem->>'mitigation' AS description,
  COALESCE(f.elem->>'severity', 'medium') AS severity,
  COALESCE(f.elem->>'probability', 'possible') AS probability,
  CASE
    WHEN f.elem->>'timing' IN ('blocking', 'post_closing', 'pre_closing', 'pre-close', 'post-close', 'ongoing', 'immediate')
    THEN f.elem->>'timing'
    ELSE NULL
  END AS timing,
  f.elem->>'mitigation' AS mitigation_recommended,
  CASE
    WHEN (f.elem->>'severity') = 'critical' THEN 1
    WHEN (f.elem->>'severity') = 'high' AND COALESCE(f.elem->>'probability', 'possible') IN ('certain', 'alta', 'probable') THEN 1
    WHEN (f.elem->>'severity') = 'high' THEN 2
    ELSE 3
  END,
  CASE
    WHEN (f.elem->>'severity') = 'critical' THEN 1
    WHEN (f.elem->>'severity') = 'high' AND COALESCE(f.elem->>'probability', 'possible') IN ('certain', 'alta', 'probable') THEN 1
    WHEN (f.elem->>'severity') = 'high' THEN 2
    ELSE 3
  END,
  'identified' AS status,
  0 AS raw_score,
  false AS is_deal_breaker,
  (f.elem->>'severity') IN ('critical', 'high') AS is_red_flag,
  (f.elem->>'severity') IN ('critical', 'high') AS hitl_required,
  jsonb_build_object(
    'backfill_source', 'workflow_metadata',
    'backfill_date', now()::text,
    'instance_id', wi.id,
    'phase', replace(key, 'phase_results_', '')
  )
FROM dd_workflow_instances wi,
     jsonb_each(wi.metadata) AS phase(key, value),
     jsonb_array_elements(
       CASE
         WHEN phase.value -> 'findings' IS NOT NULL
           AND jsonb_typeof(phase.value -> 'findings') = 'array'
           AND jsonb_array_length(phase.value -> 'findings') > 0
         THEN phase.value -> 'findings'
         ELSE '[]'::jsonb
       END
     ) AS f(elem)
WHERE phase.key LIKE 'phase_results_%'
  AND NOT EXISTS (
    SELECT 1 FROM dd_findings existing
    WHERE existing.external_ref =
      wi.id || ':' || replace(phase.key, 'phase_results_', '') || ':' ||
      left(lower(regexp_replace(f.elem->>'title', '[^a-z0-9]+', '-', 'gi')), 64)
  );
