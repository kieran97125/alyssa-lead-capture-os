-- Additional schema-only fixture for isolated acquisition qualification.
-- Requires scripts/fixtures/public-capture-db.sql; never use application data.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database()<>'public_capture_test' THEN
    RAISE EXCEPTION 'Acquisition fixtures require isolated public_capture_test';
  END IF;
END; $$;
ALTER TABLE public.forms ADD COLUMN conversion_mode text NOT NULL DEFAULT 'form_submit_pixel';
ALTER TABLE public.forms ADD COLUMN success_redirect_url text;
ALTER TABLE public.form_packages ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_packages ADD COLUMN display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.form_packages ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.form_branches ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE public.form_branches ADD COLUMN display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.form_branches ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
-- Landing Page Builder Save / Publish V1 for LaunchHub.
-- Public /lp/[slug] should render published landing page content only.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'landing_page_mode') then
    create type public.landing_page_mode as enum ('form_only', 'landing_page');
  end if;

  if not exists (select 1 from pg_type where typname = 'landing_page_status') then
    create type public.landing_page_status as enum ('draft', 'published', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'landing_page_version_status') then
    create type public.landing_page_version_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  brand_id uuid null references public.brands(id) on delete set null,
  treatment_id uuid null references public.treatments(id) on delete set null,
  package_id uuid null references public.packages(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  form_id uuid null references public.forms(id) on delete set null,
  template_key text not null,
  mode public.landing_page_mode not null default 'landing_page',
  status public.landing_page_status not null default 'draft',
  content_json jsonb not null default '{}',
  image_assets_json jsonb not null default '{}',
  published_version_id uuid null,
  created_by uuid null,
  updated_by uuid null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.landing_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.landing_pages(id) on delete cascade,
  version_number integer not null,
  status public.landing_page_version_status not null default 'draft',
  content_json jsonb not null default '{}',
  image_assets_json jsonb not null default '{}',
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique (page_id, version_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'landing_pages_published_version_id_fkey'
  ) then
    alter table public.landing_pages
      add constraint landing_pages_published_version_id_fkey
      foreign key (published_version_id)
      references public.landing_page_versions(id)
      on delete set null;
  end if;
end $$;

create index if not exists landing_pages_status_slug_idx
  on public.landing_pages(status, slug);

create index if not exists landing_pages_brand_status_idx
  on public.landing_pages(brand_id, status);

create index if not exists landing_page_versions_page_status_idx
  on public.landing_page_versions(page_id, status);

create index if not exists landing_page_versions_page_version_idx
  on public.landing_page_versions(page_id, version_number desc);


ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_pages,public.landing_page_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.landing_pages,public.landing_page_versions TO service_role;
CREATE SCHEMA acquisition_fixture;
GRANT USAGE ON SCHEMA acquisition_fixture TO service_role;
CREATE FUNCTION acquisition_fixture.ensure_seed() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.brands WHERE id='a0000000-0000-4000-8000-000000000001') THEN
    PERFORM capture_fixture.seed();
  END IF;
END; $$;
CREATE FUNCTION acquisition_fixture.page_document(slug text DEFAULT 'synthetic-page', form_id uuid DEFAULT 'e0000000-0000-4000-8000-000000000001')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('title','Synthetic page','slug',slug,'brand_id','a0000000-0000-4000-8000-000000000001',
    'form_id',form_id,'template_key','premium_offer_landing_page','mode','landing_page',
    'content_json',jsonb_build_object('heroTitle','Customer title','ctaText','Book now','heroSubtitle','Authored description'),
    'image_assets_json',jsonb_build_object('heroImageUrl','https://example.test/image.webp'));
$$;
CREATE FUNCTION acquisition_fixture.form_document() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('form_name','Synthetic managed form','brand_id','a0000000-0000-4000-8000-000000000001',
    'default_treatment_id','b0000000-0000-4000-8000-000000000001','default_package_id','c0000000-0000-4000-8000-000000000001',
    'default_branch_id','d0000000-0000-4000-8000-000000000001','package_selection_mode','fixed',
    'package_ids',jsonb_build_array('c0000000-0000-4000-8000-000000000001'),
    'branch_ids',jsonb_build_array('d0000000-0000-4000-8000-000000000001'),
    'allowed_domains',jsonb_build_array('https://example.test'),'placement_kind','landing_page','token_base','synthetic-form');
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA acquisition_fixture FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA acquisition_fixture TO service_role;

INSERT INTO public.landing_pages(id,slug,title,template_key,mode,status,content_json,image_assets_json)
VALUES('a1100000-0000-4000-8000-000000000001','legacy-public-fixture','原有標題 $ 388','legacy-template','form_only','published',
  '{"heroTitle":"Literal authored title","ctaText":"Keep this button","opaque":{"unchanged":true}}',
  '{"heroImageUrl":"https://legacy.example.test/original.webp"}');
INSERT INTO public.landing_page_versions(id,page_id,version_number,status,content_json,image_assets_json)
SELECT 'a1200000-0000-4000-8000-000000000001',id,1,'published',content_json,image_assets_json FROM public.landing_pages
WHERE id='a1100000-0000-4000-8000-000000000001';
UPDATE public.landing_pages SET published_version_id='a1200000-0000-4000-8000-000000000001'
WHERE id='a1100000-0000-4000-8000-000000000001';
