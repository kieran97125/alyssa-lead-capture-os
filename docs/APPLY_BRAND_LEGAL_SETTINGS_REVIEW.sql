-- Brand Legal Settings review/apply plan.
-- Purpose:
--   Add separate brand-level Privacy Policy and Disclaimer URLs, then correct
--   Alyssa and Ineffable legal operator metadata.
--
-- Safety:
--   - Review manually before running in Supabase SQL editor.
--   - This file only touches public.brands legal metadata.
--   - It does not alter public lead submission, forms, CRM, tracking, Sheets,
--     Pixel, thank_you_redirect, WhatsApp, or landing page persistence.
--   - Rollback is the default ending. Change rollback to commit only after
--     reviewing the preview and verification queries.

begin;

-- 1) Preview current brand legal metadata.
select
  id,
  name,
  slug,
  operator_name,
  legal_page_url,
  legal_link_label,
  default_thank_you_url,
  updated_at
from public.brands
where lower(coalesce(slug, '')) in ('alyssa', 'ineffable', 'ineffable-beauty')
   or lower(coalesce(name, '')) in ('alyssa', 'ineffable beauty')
order by slug, name;

-- 2) Add optional separate legal link fields if they are missing.
alter table public.brands
  add column if not exists privacy_url text,
  add column if not exists disclaimer_url text;

-- 3) Ensure existing fallback legal metadata columns still exist.
alter table public.brands
  add column if not exists legal_page_url text,
  add column if not exists legal_link_label text default U&'\6CD5\5F8B\689D\6B3E',
  add column if not exists operator_name text;

-- 4) Correct Alyssa legal metadata.
update public.brands
set
  operator_name = 'Alyssa Group Limited',
  privacy_url = 'https://www.alyssa.hk/privacy',
  disclaimer_url = 'https://www.alyssa.hk/disclaimer',
  legal_page_url = null,
  updated_at = now()
where lower(coalesce(slug, '')) = 'alyssa'
   or lower(coalesce(name, '')) = 'alyssa';

-- 5) Preserve Ineffable Beauty operator and existing single legal page behavior.
update public.brands
set
  operator_name = 'YISSA GROUP LIMITED',
  legal_page_url = coalesce(legal_page_url, 'https://www.ineffablebeautyhk.com/legal'),
  legal_link_label = coalesce(legal_link_label, U&'\6CD5\5F8B\689D\6B3E'),
  updated_at = now()
where lower(coalesce(slug, '')) in ('ineffable', 'ineffable-beauty')
   or lower(coalesce(name, '')) = 'ineffable beauty';

-- 6) Final verification.
select
  id,
  name,
  slug,
  operator_name,
  legal_page_url,
  legal_link_label,
  privacy_url,
  disclaimer_url,
  default_thank_you_url,
  updated_at
from public.brands
where lower(coalesce(slug, '')) in ('alyssa', 'ineffable', 'ineffable-beauty')
   or lower(coalesce(name, '')) in ('alyssa', 'ineffable beauty')
order by slug, name;

rollback;
