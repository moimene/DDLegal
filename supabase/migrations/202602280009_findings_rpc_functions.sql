-- ============================================================================
-- Migration: RPC utility functions for findings
-- Part of the Finding-Centric refactor (Fase A, Step 6)
-- ============================================================================

-- 1. get_project_findings_summary — Dashboard metrics per project
CREATE OR REPLACE FUNCTION public.get_project_findings_summary(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', count(*),
    'by_tier', jsonb_build_object(
      '1', count(*) FILTER (WHERE relevance_tier = 1),
      '2', count(*) FILTER (WHERE relevance_tier = 2),
      '3', count(*) FILTER (WHERE relevance_tier = 3)
    ),
    'by_status', jsonb_build_object(
      'identified', count(*) FILTER (WHERE status = 'identified'),
      'under_review', count(*) FILTER (WHERE status = 'under_review'),
      'validated', count(*) FILTER (WHERE status = 'validated'),
      'contested', count(*) FILTER (WHERE status = 'contested'),
      'accepted', count(*) FILTER (WHERE status = 'accepted'),
      'mitigated', count(*) FILTER (WHERE status = 'mitigated'),
      'reported', count(*) FILTER (WHERE status = 'reported'),
      'negotiated', count(*) FILTER (WHERE status = 'negotiated'),
      'resolved', count(*) FILTER (WHERE status = 'resolved'),
      'dismissed', count(*) FILTER (WHERE status = 'dismissed')
    ),
    'by_severity', jsonb_build_object(
      'critical', count(*) FILTER (WHERE severity = 'critical'),
      'high', count(*) FILTER (WHERE severity = 'high'),
      'medium', count(*) FILTER (WHERE severity = 'medium'),
      'low', count(*) FILTER (WHERE severity = 'low'),
      'informational', count(*) FILTER (WHERE severity = 'informational')
    ),
    'by_area', (
      SELECT coalesce(jsonb_object_agg(area_code, cnt), '{}'::jsonb)
      FROM (
        SELECT area_code, count(*) as cnt
        FROM dd_findings
        WHERE project_id = p_project_id AND status != 'dismissed'
        GROUP BY area_code
      ) sub
    ),
    'deal_breakers_count', count(*) FILTER (WHERE is_deal_breaker = true AND status != 'dismissed'),
    'red_flags_count', count(*) FILTER (WHERE is_red_flag = true AND status != 'dismissed'),
    'total_economic_exposure', coalesce(
      sum(economic_impact_amount) FILTER (WHERE status NOT IN ('dismissed', 'resolved') AND relevance_tier IN (1, 2)),
      0
    ),
    'pending_hitl', count(*) FILTER (WHERE hitl_required = true AND hitl_decision IS NULL AND status != 'dismissed'),
    'active_count', count(*) FILTER (WHERE status NOT IN ('resolved', 'dismissed'))
  ) INTO result
  FROM dd_findings
  WHERE project_id = p_project_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. get_finding_with_evidence — Full finding detail with evidence array
CREATE OR REPLACE FUNCTION public.get_finding_with_evidence(p_finding_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'finding', row_to_json(f.*),
    'evidence', coalesce(
      (SELECT jsonb_agg(row_to_json(e.*) ORDER BY e.similarity_score DESC NULLS LAST)
       FROM dd_finding_evidence e
       WHERE e.finding_id = f.id),
      '[]'::jsonb
    ),
    'contingency', (
      SELECT row_to_json(c.*)
      FROM dd_contingencies c
      WHERE c.id = f.contingency_id
    ),
    'negotiation_actions', coalesce(
      (SELECT jsonb_agg(row_to_json(na.*) ORDER BY na.created_at)
       FROM dd_negotiation_actions na
       WHERE na.finding_id = f.id),
      '[]'::jsonb
    ),
    'hitl_decisions', coalesce(
      (SELECT jsonb_agg(row_to_json(h.*) ORDER BY h.decided_at DESC)
       FROM dd_hitl_decisions h
       WHERE h.finding_id = f.id),
      '[]'::jsonb
    ),
    'war_room_decisions', coalesce(
      (SELECT jsonb_agg(row_to_json(w.*) ORDER BY w.decided_at DESC)
       FROM dd_war_room_decisions w
       WHERE w.finding_id = f.id),
      '[]'::jsonb
    ),
    'reports', coalesce(
      (SELECT jsonb_agg(jsonb_build_object(
        'report_id', rf.report_id,
        'section_key', rf.section_key,
        'inclusion_reason', rf.inclusion_reason,
        'included_at', rf.included_at
       ))
       FROM dd_report_findings rf
       WHERE rf.finding_id = f.id AND rf.is_excluded = false),
      '[]'::jsonb
    )
  ) INTO result
  FROM dd_findings f
  WHERE f.id = p_finding_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. validate_finding_transition — State machine enforcement
CREATE OR REPLACE FUNCTION public.validate_finding_transition(
  p_current_status TEXT,
  p_new_status TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Terminal states: no transitions out
  IF p_current_status IN ('resolved', 'dismissed') THEN
    RETURN FALSE;
  END IF;

  -- Valid transitions (Blueprint section 4.2)
  RETURN CASE
    WHEN p_current_status = 'identified' AND p_new_status IN ('under_review', 'dismissed')
      THEN TRUE
    WHEN p_current_status = 'under_review' AND p_new_status IN ('validated', 'contested', 'dismissed')
      THEN TRUE
    WHEN p_current_status = 'contested' AND p_new_status IN ('validated', 'dismissed')
      THEN TRUE
    WHEN p_current_status = 'validated' AND p_new_status IN ('accepted', 'mitigated', 'reported', 'contested')
      THEN TRUE
    WHEN p_current_status = 'accepted' AND p_new_status IN ('mitigated', 'reported')
      THEN TRUE
    WHEN p_current_status = 'mitigated' AND p_new_status IN ('reported', 'resolved')
      THEN TRUE
    WHEN p_current_status = 'reported' AND p_new_status IN ('negotiated', 'resolved')
      THEN TRUE
    WHEN p_current_status = 'negotiated' AND p_new_status IN ('resolved')
      THEN TRUE
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;


-- 4. calculate_finding_tier — Auto tier computation
CREATE OR REPLACE FUNCTION public.calculate_finding_tier(
  p_severity TEXT,
  p_probability TEXT,
  p_timing TEXT,
  p_economic_impact_amount NUMERIC,
  p_is_deal_breaker BOOLEAN
)
RETURNS INTEGER AS $$
BEGIN
  -- Tier 1: Decisorio
  IF p_is_deal_breaker THEN RETURN 1; END IF;
  IF p_severity = 'critical' AND p_timing = 'blocking' THEN RETURN 1; END IF;
  IF p_severity = 'critical' THEN RETURN 1; END IF;
  IF p_severity = 'high' AND p_probability IN ('certain', 'alta') THEN RETURN 1; END IF;

  -- Tier 2: Gestion
  IF p_severity IN ('high', 'medium') AND p_economic_impact_amount IS NOT NULL AND p_economic_impact_amount > 0 THEN RETURN 2; END IF;
  IF p_timing = 'blocking' THEN RETURN 2; END IF;
  IF p_severity = 'high' THEN RETURN 2; END IF;

  -- Tier 3: Registro
  RETURN 3;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;


-- 5. calculate_finding_score — Score computation matching deal-risk-score.ts
CREATE OR REPLACE FUNCTION public.calculate_finding_score(
  p_severity TEXT,
  p_probability TEXT,
  p_timing TEXT
)
RETURNS NUMERIC(5,2) AS $$
DECLARE
  severity_weight NUMERIC;
  probability_weight NUMERIC;
  timing_multiplier NUMERIC;
BEGIN
  severity_weight := CASE p_severity
    WHEN 'critical' THEN 1.0
    WHEN 'high' THEN 0.75
    WHEN 'medium' THEN 0.4
    WHEN 'low' THEN 0.15
    WHEN 'informational' THEN 0.0
    ELSE 0.0
  END;

  probability_weight := CASE p_probability
    WHEN 'certain' THEN 1.0
    WHEN 'alta' THEN 0.9
    WHEN 'probable' THEN 0.75
    WHEN 'media' THEN 0.5
    WHEN 'possible' THEN 0.4
    WHEN 'baja' THEN 0.2
    WHEN 'remote' THEN 0.15
    ELSE 0.3
  END;

  timing_multiplier := CASE p_timing
    WHEN 'blocking' THEN 1.5
    ELSE 1.0
  END;

  RETURN ROUND((severity_weight * probability_weight * timing_multiplier * 100)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;


-- 6. Normalize probability — Maps legacy values to canonical taxonomy
CREATE OR REPLACE FUNCTION public.normalize_probability(p_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE lower(trim(p_input))
    WHEN 'certain' THEN 'certain'
    WHEN 'alta' THEN 'alta'
    WHEN 'high' THEN 'alta'
    WHEN 'probable' THEN 'probable'
    WHEN 'media' THEN 'media'
    WHEN 'medium' THEN 'media'
    WHEN 'possible' THEN 'possible'
    WHEN 'baja' THEN 'baja'
    WHEN 'low' THEN 'baja'
    WHEN 'remote' THEN 'remote'
    ELSE 'media'  -- safe default
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;


-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_project_findings_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finding_with_evidence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_finding_transition(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_finding_tier(TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_finding_score(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_probability(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slugify(TEXT) TO authenticated;


-- Comments
COMMENT ON FUNCTION public.get_project_findings_summary IS
  'Returns aggregated metrics for all findings in a project: counts by tier/status/severity/area, economic exposure, HITL pending.';
COMMENT ON FUNCTION public.validate_finding_transition IS
  'Validates if a status transition is allowed per the finding lifecycle state machine. Returns TRUE if valid.';
COMMENT ON FUNCTION public.calculate_finding_tier IS
  'Computes the auto-calculated relevance tier (1/2/3) based on finding dimensions.';
COMMENT ON FUNCTION public.calculate_finding_score IS
  'Computes raw_score for a finding using the severity×probability×timing formula from deal-risk-score.ts.';
