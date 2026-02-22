-- ============================================================
-- Migration 202602270008: Extend dd_hitl_decisions for workflow-level HITL
--
-- The existing table is task-centric (audit trail for kanban task decisions).
-- Golden Path requires workflow-level HITL tracking:
--   - Auto-create HITL decisions when entering HITL-required phases
--   - Track by workflow_instance_id + phase + finding
--   - Report generator aggregates by phase
--
-- Approach: expand/contract — make task_id & decision nullable,
-- add workflow-level columns. Existing inserts continue to work.
-- ============================================================

-- 1. Make task_id nullable (workflow-level HITL doesn't start from a specific task)
ALTER TABLE dd_hitl_decisions ALTER COLUMN task_id DROP NOT NULL;

-- 2. Make decision nullable (auto-created HITL starts as pending, decision comes later)
ALTER TABLE dd_hitl_decisions ALTER COLUMN decision DROP NOT NULL;

-- 3. Add workflow-level columns
ALTER TABLE dd_hitl_decisions
  ADD COLUMN IF NOT EXISTS workflow_instance_id UUID REFERENCES dd_workflow_instances(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS finding_title TEXT,
  ADD COLUMN IF NOT EXISTS finding_severity TEXT CHECK (finding_severity IN ('critical', 'high', 'medium', 'low', 'informational')),
  ADD COLUMN IF NOT EXISTS ai_output JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'needs_evidence', 'escalated'));

-- 4. Indexes for workflow-level queries
CREATE INDEX IF NOT EXISTS idx_hitl_workflow_instance ON dd_hitl_decisions(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_hitl_phase ON dd_hitl_decisions(workflow_instance_id, phase);
CREATE INDEX IF NOT EXISTS idx_hitl_status ON dd_hitl_decisions(status);

-- 5. RLS policy for workflow-level HITL (extend existing)
-- The table already has RLS enabled from the original migration.
-- Add policy for reading workflow-level decisions via project membership.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dd_hitl_decisions' AND policyname = 'hitl_workflow_select'
  ) THEN
    CREATE POLICY hitl_workflow_select ON dd_hitl_decisions
      FOR SELECT USING (
        workflow_instance_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM dd_workflow_instances wi
          JOIN dd_project_user_roles pur ON pur.project_id = wi.project_id
          WHERE wi.id = dd_hitl_decisions.workflow_instance_id
          AND pur.user_id = auth.uid()
          AND pur.is_active = true
        )
      );
  END IF;
END $$;

-- 6. Update policy for workflow HITL (only specific roles can approve/reject)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dd_hitl_decisions' AND policyname = 'hitl_workflow_update'
  ) THEN
    CREATE POLICY hitl_workflow_update ON dd_hitl_decisions
      FOR UPDATE USING (
        workflow_instance_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM dd_workflow_instances wi
          JOIN dd_project_user_roles pur ON pur.project_id = wi.project_id
          WHERE wi.id = dd_hitl_decisions.workflow_instance_id
          AND pur.user_id = auth.uid()
          AND pur.role IN ('clo', 'pm_transaccion', 'abogado_area')
          AND pur.is_active = true
        )
      );
  END IF;
END $$;
