-- ============================================================
-- Migration: Reports Freeze & Visibility
-- Extends dd_reports with freeze/visibility fields adelantado
-- from Phase 3 per legal team request.
-- Date: 2026-02-23
-- ============================================================

begin;

-- ============================================================
-- 1. Add new columns to dd_reports
-- ============================================================
do $$
begin
  if to_regclass('public.dd_reports') is not null then
    alter table public.dd_reports
      add column if not exists report_category text default 'transactional',
      add column if not exists version_number integer default 1,
      add column if not exists is_frozen boolean default false,
      add column if not exists frozen_at timestamptz,
      add column if not exists frozen_by uuid,
      add column if not exists visibility text default 'internal';
  end if;
end $$;

-- ============================================================
-- 2. Add check constraints safely
-- ============================================================
do $$
begin
  if to_regclass('public.dd_reports') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'dd_reports_report_category_check'
    ) then
      alter table public.dd_reports
        add constraint dd_reports_report_category_check
        check (report_category in (
          'operational','workstream','consolidated',
          'transactional','final','negotiation'
        ));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'dd_reports_visibility_check'
    ) then
      alter table public.dd_reports
        add constraint dd_reports_visibility_check
        check (visibility in (
          'internal','client','deal_team',
          'counterparty','committee'
        ));
    end if;
  end if;
end $$;

-- ============================================================
-- 3. Indexes for new columns
-- ============================================================
create index if not exists idx_dd_reports_report_category
  on public.dd_reports(report_category);
create index if not exists idx_dd_reports_is_frozen
  on public.dd_reports(is_frozen);

commit;
