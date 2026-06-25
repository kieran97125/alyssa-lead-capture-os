-- Brand-level Legal / Operator settings for LaunchHub.
-- Run this manually in Supabase SQL editor after reviewing.
-- Do not run from Codex automatically.

begin;

alter table public.brands
  add column if not exists legal_page_url text,
  add column if not exists legal_link_label text default U&'\6CD5\5F8B\689D\6B3E',
  add column if not exists operator_name text;

update public.brands
set
  legal_page_url = 'https://www.ineffablebeautyhk.com/legal',
  legal_link_label = U&'\6CD5\5F8B\689D\6B3E',
  operator_name = 'YISSA GROUP LIMITED',
  updated_at = now()
where lower(coalesce(slug, '')) in ('ineffable', 'ineffable-beauty')
   or lower(coalesce(name, '')) = 'ineffable beauty';

commit;