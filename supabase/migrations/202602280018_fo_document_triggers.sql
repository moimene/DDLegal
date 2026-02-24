-- Migration: Triggers for automatic FO document analysis
-- 1. Re-analyze when document content changes
-- 2. Create pending entries when new FO added
-- 3. Create pending entries when new document added

BEGIN;

-- Trigger: Document content changed → mark for re-analysis
CREATE OR REPLACE FUNCTION trigger_fo_reanalysis_on_doc_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
    UPDATE dd_fo_document_status
    SET status = 'pending',
        content_hash_at_analysis = NULL,
        analyzed_at = NULL,
        finding_generated = false,
        finding_id = NULL,
        rule_execution_id = NULL
    WHERE document_id = NEW.id
      AND status = 'analyzed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vdr_doc_content_change ON vdr_documents;
CREATE TRIGGER trg_vdr_doc_content_change
  AFTER UPDATE OF content_hash ON vdr_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fo_reanalysis_on_doc_update();

-- Trigger: New FO → create pending for existing documents
CREATE OR REPLACE FUNCTION trigger_fo_docs_on_new_objective()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for active projects with documents
  INSERT INTO dd_fo_document_status (project_id, objective_id, document_id, status)
  SELECT DISTINCT
    vd.project_id,
    NEW.id,
    vd.id,
    'pending'
  FROM vdr_documents vd
  INNER JOIN dd_projects p ON p.id = vd.project_id
  WHERE p.status = 'active'
  ON CONFLICT (project_id, objective_id, document_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_finding_objective ON dd_finding_objectives;
CREATE TRIGGER trg_new_finding_objective
  AFTER INSERT ON dd_finding_objectives
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION trigger_fo_docs_on_new_objective();

-- Trigger: New document → create pending for applicable FOs
CREATE OR REPLACE FUNCTION trigger_fo_status_on_new_document()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dd_fo_document_status (project_id, objective_id, document_id, status)
  SELECT
    NEW.project_id,
    fo.id,
    NEW.id,
    'pending'
  FROM dd_finding_objectives fo
  WHERE fo.is_active = true
  ON CONFLICT (project_id, objective_id, document_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vdr_doc_new ON vdr_documents;
CREATE TRIGGER trg_vdr_doc_new
  AFTER INSERT ON vdr_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fo_status_on_new_document();

COMMIT;
