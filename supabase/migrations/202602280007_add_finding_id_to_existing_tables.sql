-- ============================================================================
-- Migration: Add finding_id FK to existing consumer tables
-- Part of the Finding-Centric refactor (Fase A, Step 4)
-- All columns are NULLABLE to support progressive backfill (legacy rows stay NULL).
-- ============================================================================

-- 1. dd_contingencies — bidirectional link (finding also has contingency_id)
ALTER TABLE public.dd_contingencies
  ADD COLUMN IF NOT EXISTS finding_id UUID;

-- Add FK constraint (conditional to avoid duplicate if re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contingencies_finding'
    AND table_name = 'dd_contingencies'
  ) THEN
    ALTER TABLE public.dd_contingencies
      ADD CONSTRAINT fk_contingencies_finding
      FOREIGN KEY (finding_id) REFERENCES public.dd_findings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unique: one contingency per finding (1:0..1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_dd_contingencies_finding_id'
  ) THEN
    CREATE UNIQUE INDEX uq_dd_contingencies_finding_id
      ON public.dd_contingencies(finding_id) WHERE finding_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dd_contingencies_finding
  ON public.dd_contingencies(finding_id) WHERE finding_id IS NOT NULL;


-- 2. dd_negotiation_actions — finding_id alongside legacy finding_ref
ALTER TABLE public.dd_negotiation_actions
  ADD COLUMN IF NOT EXISTS finding_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_negotiation_actions_finding'
    AND table_name = 'dd_negotiation_actions'
  ) THEN
    ALTER TABLE public.dd_negotiation_actions
      ADD CONSTRAINT fk_negotiation_actions_finding
      FOREIGN KEY (finding_id) REFERENCES public.dd_findings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dd_negotiation_actions_finding
  ON public.dd_negotiation_actions(finding_id) WHERE finding_id IS NOT NULL;


-- 3. dd_hitl_decisions — link HITL decisions to specific findings
ALTER TABLE public.dd_hitl_decisions
  ADD COLUMN IF NOT EXISTS finding_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_hitl_decisions_finding'
    AND table_name = 'dd_hitl_decisions'
  ) THEN
    ALTER TABLE public.dd_hitl_decisions
      ADD CONSTRAINT fk_hitl_decisions_finding
      FOREIGN KEY (finding_id) REFERENCES public.dd_findings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dd_hitl_decisions_finding
  ON public.dd_hitl_decisions(finding_id) WHERE finding_id IS NOT NULL;


-- 4. dd_war_room_decisions — link war room decisions to findings
ALTER TABLE public.dd_war_room_decisions
  ADD COLUMN IF NOT EXISTS finding_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_war_room_decisions_finding'
    AND table_name = 'dd_war_room_decisions'
  ) THEN
    ALTER TABLE public.dd_war_room_decisions
      ADD CONSTRAINT fk_war_room_decisions_finding
      FOREIGN KEY (finding_id) REFERENCES public.dd_findings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dd_war_room_decisions_finding
  ON public.dd_war_room_decisions(finding_id) WHERE finding_id IS NOT NULL;


-- 5. dd_kanban_tasks — link tasks to individual findings (AP-level)
ALTER TABLE public.dd_kanban_tasks
  ADD COLUMN IF NOT EXISTS finding_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_kanban_tasks_finding'
    AND table_name = 'dd_kanban_tasks'
  ) THEN
    ALTER TABLE public.dd_kanban_tasks
      ADD CONSTRAINT fk_kanban_tasks_finding
      FOREIGN KEY (finding_id) REFERENCES public.dd_findings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dd_kanban_tasks_finding
  ON public.dd_kanban_tasks(finding_id) WHERE finding_id IS NOT NULL;


-- Comments
COMMENT ON COLUMN public.dd_contingencies.finding_id IS
  'Bidirectional link to dd_findings. Populated during dual-write (new) or backfill (legacy).';
COMMENT ON COLUMN public.dd_negotiation_actions.finding_id IS
  'Canonical FK to dd_findings. Coexists with legacy finding_ref (TEXT) during transition.';
COMMENT ON COLUMN public.dd_hitl_decisions.finding_id IS
  'Links HITL decision to the specific finding being reviewed.';
COMMENT ON COLUMN public.dd_war_room_decisions.finding_id IS
  'Links war room decision to the specific finding being decided upon.';
COMMENT ON COLUMN public.dd_kanban_tasks.finding_id IS
  'Links kanban task to a specific finding (AP-level). Tier 1 findings get individual tasks.';
