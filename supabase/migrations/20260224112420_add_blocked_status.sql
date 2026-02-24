-- Migration: Add 'blocked' status to dd_fo_document_status
-- This enables tracking when Finding Objectives cannot proceed due to missing documents

BEGIN;

-- ============================================================================
-- 1. Add new columns for blocked status tracking
-- ============================================================================

-- Add blocked_reason column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'dd_fo_document_status'
          AND column_name = 'blocked_reason'
    ) THEN
        ALTER TABLE public.dd_fo_document_status
        ADD COLUMN blocked_reason TEXT DEFAULT NULL;
    END IF;
END $$;

-- Add blocked_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'dd_fo_document_status'
          AND column_name = 'blocked_at'
    ) THEN
        ALTER TABLE public.dd_fo_document_status
        ADD COLUMN blocked_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Add missing_doc_types column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'dd_fo_document_status'
          AND column_name = 'missing_doc_types'
    ) THEN
        ALTER TABLE public.dd_fo_document_status
        ADD COLUMN missing_doc_types TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- ============================================================================
-- 2. Update CHECK constraint to include 'blocked' status
-- ============================================================================

-- Drop existing constraint and recreate with 'blocked' added
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_fods_status'
          AND table_name = 'dd_fo_document_status'
    ) THEN
        ALTER TABLE public.dd_fo_document_status DROP CONSTRAINT chk_fods_status;
    END IF;

    -- Add updated constraint with 'blocked' status
    ALTER TABLE public.dd_fo_document_status
    ADD CONSTRAINT chk_fods_status
    CHECK (status IN ('pending', 'analyzing', 'analyzed', 'skipped', 'error', 'blocked'));
END $$;

-- ============================================================================
-- 3. Create partial index for efficient blocked document queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fo_doc_status_blocked
ON public.dd_fo_document_status (project_id, status)
WHERE status = 'blocked';

-- ============================================================================
-- 4. Create RPC: block_fo_document
-- ============================================================================

CREATE OR REPLACE FUNCTION public.block_fo_document(
    p_document_id UUID,
    p_objective_id UUID,
    p_reason TEXT,
    p_missing_doc_types TEXT[] DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.dd_fo_document_status
    SET
        status = 'blocked',
        blocked_reason = p_reason,
        blocked_at = NOW(),
        missing_doc_types = p_missing_doc_types
    WHERE document_id = p_document_id
      AND objective_id = p_objective_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No FO document status found for document_id % and objective_id %',
            p_document_id, p_objective_id;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.block_fo_document(UUID, UUID, TEXT, TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.block_fo_document IS
'Blocks a Finding Objective document pair, recording the reason and any missing document types';

-- ============================================================================
-- 5. Create RPC: unblock_fo_document
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unblock_fo_document(
    p_document_id UUID,
    p_objective_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.dd_fo_document_status
    SET
        status = 'pending',
        blocked_reason = NULL,
        blocked_at = NULL,
        missing_doc_types = '{}'
    WHERE document_id = p_document_id
      AND objective_id = p_objective_id
      AND status = 'blocked';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No blocked FO document status found for document_id % and objective_id %',
            p_document_id, p_objective_id;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.unblock_fo_document(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.unblock_fo_document IS
'Unblocks a previously blocked Finding Objective document pair, resetting it to pending status';

-- ============================================================================
-- 6. Create RPC: get_blocked_fos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_blocked_fos(
    p_project_id UUID
)
RETURNS TABLE (
    document_id UUID,
    objective_id UUID,
    objective_key VARCHAR,
    blocked_reason TEXT,
    blocked_at TIMESTAMPTZ,
    missing_doc_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fds.document_id,
        fds.objective_id,
        fo.objective_key,
        fds.blocked_reason,
        fds.blocked_at,
        fds.missing_doc_types
    FROM public.dd_fo_document_status fds
    INNER JOIN public.dd_finding_objectives fo
        ON fds.objective_id = fo.id
    WHERE fds.project_id = p_project_id
      AND fds.status = 'blocked'
    ORDER BY fds.blocked_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_blocked_fos(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_blocked_fos IS
'Returns all blocked Finding Objective document pairs for a project, ordered by blocked_at descending';

COMMIT;
