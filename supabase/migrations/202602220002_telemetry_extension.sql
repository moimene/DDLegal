-- ============================================================
-- Migration: Phase 1 — Telemetry Extension
-- Extends dd_tool_executions with agent telemetry fields:
-- token usage, model tracking, agent status, grounding score.
-- Date: 2026-02-22
-- ============================================================

begin;

do $$
begin
  if to_regclass('public.dd_tool_executions') is not null then
    -- Token usage
    alter table public.dd_tool_executions
      add column if not exists tokens_in integer;

    alter table public.dd_tool_executions
      add column if not exists tokens_out integer;

    -- Model identification
    alter table public.dd_tool_executions
      add column if not exists model_used text;

    -- Agent-level status (distinct from tool execution status)
    alter table public.dd_tool_executions
      add column if not exists agent_status text;

    -- Agent error classification
    alter table public.dd_tool_executions
      add column if not exists agent_error_type text;

    -- Grounding quality score (0-100)
    alter table public.dd_tool_executions
      add column if not exists grounding_score numeric(5,2);

    -- Add check constraints safely
    if not exists (
      select 1 from pg_constraint where conname = 'dd_tool_executions_agent_status_check'
    ) then
      alter table public.dd_tool_executions
        add constraint dd_tool_executions_agent_status_check
        check (agent_status in ('success', 'error', 'timeout'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'dd_tool_executions_grounding_score_check'
    ) then
      alter table public.dd_tool_executions
        add constraint dd_tool_executions_grounding_score_check
        check (grounding_score >= 0 and grounding_score <= 100);
    end if;
  end if;
end $$;

-- Index for filtering by agent status (error investigations, success rates)
create index if not exists idx_dd_tool_executions_agent_status
  on public.dd_tool_executions(agent_status);

commit;
