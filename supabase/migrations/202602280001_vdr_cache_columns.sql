-- ============================================================
-- Migration: Add cache columns to vdr_documents
-- Adds content_hash, embedding_status, embedding_hash, last_embedded_at
-- for level-1 document cache (skip re-parsing unchanged docs).
-- Date: 2026-02-28
-- ============================================================

begin;

-- Add content_hash for deduplication
alter table public.vdr_documents
  add column if not exists content_hash text;

-- Add embedding lifecycle columns
alter table public.vdr_documents
  add column if not exists embedding_status text default 'pending'
    check (embedding_status in ('pending', 'processing', 'done', 'stale'));

alter table public.vdr_documents
  add column if not exists embedding_hash text;

alter table public.vdr_documents
  add column if not exists last_embedded_at timestamptz;

-- Index for cache lookups
create index if not exists idx_vdr_docs_content_hash
  on public.vdr_documents(project_id, content_hash);

create index if not exists idx_vdr_docs_embedding_status
  on public.vdr_documents(project_id, embedding_status);

commit;
