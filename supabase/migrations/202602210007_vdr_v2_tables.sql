-- VDR v2 tables (prerequisite for vectorization)
-- Applied to Supabase 2026-02-21

create table if not exists public.vdr_folders (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references dd_projects(id) on delete cascade,
  parent_id  uuid null references vdr_folders(id) on delete cascade,
  name       text not null,
  area_code  text null,
  sort_order integer default 0,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, parent_id, name)
);

create index if not exists idx_vdr_folders_project_id on public.vdr_folders(project_id);
create index if not exists idx_vdr_folders_parent_id on public.vdr_folders(parent_id);

create table if not exists public.vdr_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references dd_projects(id) on delete cascade,
  folder_id       uuid null references vdr_folders(id) on delete set null,
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

create index if not exists idx_vdr_documents_project_id on public.vdr_documents(project_id);
create index if not exists idx_vdr_documents_folder_id on public.vdr_documents(folder_id);
create index if not exists idx_vdr_documents_status on public.vdr_documents(status);
create index if not exists idx_vdr_documents_area_code on public.vdr_documents(area_code);

create table if not exists public.vdr_document_versions (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references vdr_documents(id) on delete cascade,
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

create index if not exists idx_vdr_document_versions_document_id on public.vdr_document_versions(document_id);

create table if not exists public.vdr_acl (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null,
  document_id uuid null,
  folder_id   uuid null,
  role        text not null,
  area_code   text null,
  permission  text not null check (permission in ('view','download','upload','edit','delete','manage')),
  created_at  timestamptz not null default now(),
  check (document_id is not null or folder_id is not null)
);

create index if not exists idx_vdr_acl_resolve on public.vdr_acl(project_id, folder_id, role);
create index if not exists idx_vdr_acl_doc_resolve on public.vdr_acl(project_id, document_id, role);

create table if not exists public.vdr_links (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid null,
  folder_id        uuid null,
  token            text not null unique,
  permission       text not null default 'view' check (permission in ('view','download')),
  expires_at       timestamptz not null,
  max_downloads    integer null,
  downloads_count  integer default 0,
  is_revoked       boolean default false,
  created_by       uuid null,
  created_at       timestamptz not null default now()
);

-- Compatibility view
create or replace view public.dd_documents_compat as
select vd.id, vd.project_id, vd.area_code, vd.name,
  coalesce(vv.original_filename, vd.name) as original_filename,
  coalesce(vv.file_type, 'unknown') as file_type,
  coalesce(vv.file_size_bytes, 0) as file_size_bytes,
  vv.storage_path, vd.status, vd.category, vd.uploaded_by::text,
  vd.metadata, vd.created_at, vd.updated_at
from public.vdr_documents vd
left join lateral (
  select * from public.vdr_document_versions where document_id = vd.id order by version_number desc limit 1
) vv on true;

-- RLS
alter table public.vdr_folders enable row level security;
alter table public.vdr_documents enable row level security;
alter table public.vdr_document_versions enable row level security;
alter table public.vdr_acl enable row level security;
alter table public.vdr_links enable row level security;

create policy "service_vdr_folders" on vdr_folders for all using (auth.role() = 'service_role');
create policy "service_vdr_documents" on vdr_documents for all using (auth.role() = 'service_role');
create policy "service_vdr_versions" on vdr_document_versions for all using (auth.role() = 'service_role');
create policy "service_vdr_acl" on vdr_acl for all using (auth.role() = 'service_role');
create policy "service_vdr_links" on vdr_links for all using (auth.role() = 'service_role');

create policy "select_vdr_folders" on vdr_folders for select using (
  exists (select 1 from dd_project_user_roles r where r.project_id = vdr_folders.project_id and r.user_id = auth.uid() and r.is_active = true and (r.expires_at is null or r.expires_at > now()))
);
create policy "select_vdr_documents" on vdr_documents for select using (
  exists (select 1 from dd_project_user_roles r where r.project_id = vdr_documents.project_id and r.user_id = auth.uid() and r.is_active = true and (r.expires_at is null or r.expires_at > now()))
);
create policy "select_vdr_versions" on vdr_document_versions for select using (
  exists (select 1 from vdr_documents d join dd_project_user_roles r on r.project_id = d.project_id where d.id = vdr_document_versions.document_id and r.user_id = auth.uid() and r.is_active = true and (r.expires_at is null or r.expires_at > now()))
);
create policy "select_vdr_acl" on vdr_acl for select using (
  exists (select 1 from dd_project_user_roles r where r.project_id = vdr_acl.project_id and r.user_id = auth.uid() and r.is_active = true and (r.expires_at is null or r.expires_at > now()))
);
create policy "select_vdr_links" on vdr_links for select using (
  exists (select 1 from vdr_documents d join dd_project_user_roles r on r.project_id = d.project_id where d.id = vdr_links.document_id and r.user_id = auth.uid() and r.is_active = true and (r.expires_at is null or r.expires_at > now()))
);
