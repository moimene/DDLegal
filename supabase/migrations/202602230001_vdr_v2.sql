-- ============================================================
-- Migration: VDR v2 — Virtual Data Room tables
-- Creates vdr_folders, vdr_documents, vdr_document_versions,
-- vdr_acl, vdr_links, and dd_documents_compat view.
-- Includes RLS with role-based access via dd_project_user_roles.
-- Date: 2026-02-23
-- ============================================================

begin;

-- ============================================================
-- 1. vdr_folders — Hierarchical folder structure
-- ============================================================
create table if not exists public.vdr_folders (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  parent_id  uuid null,
  name       text not null,
  area_code  text null,
  sort_order integer default 0,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, parent_id, name)
);

-- FK: project_id -> dd_projects(id) CASCADE
do $$
begin
  alter table public.vdr_folders
    add constraint vdr_folders_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- FK: parent_id -> vdr_folders(id) CASCADE (self-referential)
do $$
begin
  alter table public.vdr_folders
    add constraint vdr_folders_parent_id_fkey
    foreign key (parent_id) references public.vdr_folders(id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_vdr_folders_project_id on public.vdr_folders(project_id);
create index if not exists idx_vdr_folders_parent_id on public.vdr_folders(parent_id);

-- ============================================================
-- 2. vdr_documents — Document metadata (version-aware)
-- ============================================================
create table if not exists public.vdr_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null,
  folder_id       uuid null,
  area_code       text null,
  name            text not null,
  description     text null,
  category        text default 'general',
  status          text not null default 'draft'
    check (status in ('draft','staged','uploaded','processing','indexed','superseded','archived','error')),
  is_confidential boolean default false,
  tags            text[] default '{}',
  uploaded_by     uuid null,
  approved_by     uuid null,
  approved_at     timestamptz null,
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- FK: project_id -> dd_projects(id) CASCADE
do $$
begin
  alter table public.vdr_documents
    add constraint vdr_documents_project_id_fkey
    foreign key (project_id) references public.dd_projects(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- FK: folder_id -> vdr_folders(id) SET NULL
do $$
begin
  alter table public.vdr_documents
    add constraint vdr_documents_folder_id_fkey
    foreign key (folder_id) references public.vdr_folders(id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists idx_vdr_documents_project_id on public.vdr_documents(project_id);
create index if not exists idx_vdr_documents_folder_id on public.vdr_documents(folder_id);
create index if not exists idx_vdr_documents_status on public.vdr_documents(status);
create index if not exists idx_vdr_documents_area_code on public.vdr_documents(area_code);

-- ============================================================
-- 3. vdr_document_versions — File versions per document
-- ============================================================
create table if not exists public.vdr_document_versions (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null,
  version_number    integer not null,
  original_filename text not null,
  file_type         text not null,
  file_size_bytes   bigint,
  storage_path      text not null,
  checksum_sha256   text null,
  change_notes      text null,
  uploaded_by       uuid null,
  created_at        timestamptz not null default now(),
  unique(document_id, version_number)
);

-- FK: document_id -> vdr_documents(id) CASCADE
do $$
begin
  alter table public.vdr_document_versions
    add constraint vdr_document_versions_document_id_fkey
    foreign key (document_id) references public.vdr_documents(id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists idx_vdr_document_versions_document_id on public.vdr_document_versions(document_id);

-- ============================================================
-- 4. vdr_acl — Access control list (folder or document scoped)
-- ============================================================
create table if not exists public.vdr_acl (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null,
  document_id uuid null,
  folder_id   uuid null,
  role        text not null,
  area_code   text null,
  permission  text not null
    check (permission in ('view','download','upload','edit','delete','manage')),
  created_at  timestamptz not null default now(),
  check (document_id is not null or folder_id is not null)
);

create index if not exists idx_vdr_acl_resolve
  on public.vdr_acl(project_id, folder_id, role);
create index if not exists idx_vdr_acl_doc_resolve
  on public.vdr_acl(project_id, document_id, role);

-- ============================================================
-- 5. vdr_links — Shareable document/folder links
-- ============================================================
create table if not exists public.vdr_links (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid null,
  folder_id        uuid null,
  token            text not null unique,
  permission       text not null default 'view'
    check (permission in ('view','download')),
  expires_at       timestamptz not null,
  max_downloads    integer null,
  downloads_count  integer default 0,
  is_revoked       boolean default false,
  created_by       uuid null,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 6. dd_documents_compat — Read-only compatibility view
--    Maps new VDR schema to old dd_documents shape.
--    NO dual-write; consumers should migrate to vdr_documents.
-- ============================================================
create or replace view public.dd_documents_compat as
select
  vd.id,
  vd.project_id,
  vd.area_code,
  vd.name,
  coalesce(vv.original_filename, vd.name) as original_filename,
  coalesce(vv.file_type, 'unknown')       as file_type,
  coalesce(vv.file_size_bytes, 0)         as file_size_bytes,
  vv.storage_path,
  vd.status,
  vd.category,
  vd.uploaded_by::text,
  vd.metadata,
  vd.created_at,
  vd.updated_at
from public.vdr_documents vd
left join lateral (
  select *
  from public.vdr_document_versions
  where document_id = vd.id
  order by version_number desc
  limit 1
) vv on true;

-- ============================================================
-- 7. RLS — Role-based access on all VDR tables
-- ============================================================

-- ----- vdr_folders -----
alter table public.vdr_folders enable row level security;

create policy "vdr_folders_service_bypass"
  on public.vdr_folders for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "vdr_folders_select_assigned"
  on public.vdr_folders for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = vdr_folders.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- vdr_documents -----
alter table public.vdr_documents enable row level security;

create policy "vdr_documents_service_bypass"
  on public.vdr_documents for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "vdr_documents_select_assigned"
  on public.vdr_documents for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = vdr_documents.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- vdr_document_versions -----
alter table public.vdr_document_versions enable row level security;

create policy "vdr_document_versions_service_bypass"
  on public.vdr_document_versions for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "vdr_document_versions_select_assigned"
  on public.vdr_document_versions for select
  using (
    exists (
      select 1 from public.vdr_documents vd
      join public.dd_project_user_roles r on r.project_id = vd.project_id
      where vd.id = vdr_document_versions.document_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- vdr_acl -----
alter table public.vdr_acl enable row level security;

create policy "vdr_acl_service_bypass"
  on public.vdr_acl for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "vdr_acl_select_assigned"
  on public.vdr_acl for select
  using (
    exists (
      select 1 from public.dd_project_user_roles r
      where r.project_id = vdr_acl.project_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

-- ----- vdr_links -----
alter table public.vdr_links enable row level security;

create policy "vdr_links_service_bypass"
  on public.vdr_links for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

create policy "vdr_links_select_assigned"
  on public.vdr_links for select
  using (
    exists (
      select 1 from public.vdr_documents vd
      join public.dd_project_user_roles r on r.project_id = vd.project_id
      where vd.id = vdr_links.document_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or exists (
      select 1 from public.vdr_folders vf
      join public.dd_project_user_roles r on r.project_id = vf.project_id
      where vf.id = vdr_links.folder_id
        and r.user_id = auth.uid()
        and r.is_active = true
        and (r.expires_at is null or r.expires_at > now())
    )
    or current_setting('role') = 'service_role'
  );

commit;
