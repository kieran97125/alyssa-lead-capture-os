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

insert into public.landing_pages (
  id,
  slug,
  title,
  brand_id,
  treatment_id,
  package_id,
  branch_id,
  form_id,
  template_key,
  mode,
  status,
  content_json,
  image_assets_json,
  published_at
)
values (
  '66666666-6666-4666-8666-666666666661',
  'alyssa-main-trial-offer',
  'Alyssa First-Visit Trial Offer',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333332',
  '44444444-4444-4444-8444-444444444441',
  '55555555-5555-4555-8555-555555555551',
  'premium_offer_landing_page',
  'landing_page',
  'published',
  jsonb_build_object(
    'templateName', 'Premium offer landing page',
    'testingStatus', 'ready_for_testing',
    'heroTitle', 'First-visit medical beauty trial',
    'heroSubtitle', 'A premium Alyssa campaign page for testing the HK$388 first-visit trial offer while keeping the same lead attribution and booking flow.',
    'offerBadge', 'HKD 388 First-Visit Trial',
    'offerHeadline', 'First-visit trial offer from HK$388',
    'offerBody', 'A focused campaign offer for clients who want a consultation, treatment recommendation, and WhatsApp booking follow-up without replacing the main Wix website.',
    'ctaText', 'Book the trial offer',
    'secondaryCtaText', 'View treatment details',
    'painPoints', jsonb_build_array(
      'Customers want a clear first-visit offer before committing.',
      'Marketing needs a faster way to test offer angles outside the main Wix site.',
      'Operations need every campaign lead to keep source and booking context.'
    ),
    'benefits', jsonb_build_array(
      'HK$388 first-visit trial offer.',
      'UTM and click ID attribution are captured with the lead.',
      'Booking request can later be followed up from the future WhatsApp CRM.'
    ),
    'trustItems', jsonb_build_array(
      'Designed for Alyssa medical beauty campaign testing.',
      'Uses the shared lead base for future paid / show / lost outcome write-back.',
      'Wix remains the main website; this page is a campaign testing layer.'
    ),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Built for fast campaign testing',
        'body', 'Landing page mode lets Alyssa test one offer, one treatment angle, and one embedded booking form without changing the main website.'
      ),
      jsonb_build_object(
        'title', 'Still connected to form-only mode',
        'body', 'The same form token and attribution flow can be embedded into Wix pages when Wix already owns the page content.'
      ),
      jsonb_build_object(
        'title', 'CRM-ready attribution',
        'body', 'Campaign Launch OS keeps the original campaign source ready for the future WhatsApp CRM to write back outcomes.'
      )
    ),
    'processSteps', jsonb_build_array(
      jsonb_build_object(
        'title', '1. Submit booking request',
        'body', 'Customer chooses the offer and submits the Alyssa form with campaign attribution attached.'
      ),
      jsonb_build_object(
        'title', '2. WhatsApp follow-up',
        'body', 'The future CRM can confirm booking details and continue the conversation.'
      ),
      jsonb_build_object(
        'title', '3. Outcome write-back',
        'body', 'Paid, show, no-show, and lost outcomes can later be written back to the shared lead base.'
      )
    ),
    'faqs', jsonb_build_array(
      jsonb_build_object(
        'question', 'Is this a full Wix replacement?',
        'answer', 'No. Wix remains the main website. Campaign Launch OS landing pages are for campaign offer and angle testing.'
      ),
      jsonb_build_object(
        'question', 'Does booking_only mean the package is free?',
        'answer', 'No. booking_only means no payment flow was started. The package price remains the selected display price.'
      ),
      jsonb_build_object(
        'question', 'Will UTM and click IDs still be captured?',
        'answer', 'Yes. The public landing page keeps the existing embedded form and attribution capture flow.'
      )
    )
  ),
  jsonb_build_object(
    'heroImageUrl', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80',
    'mobileHeroImageUrl', '',
    'offerImageUrl', '',
    'treatmentImageUrl', '',
    'processImage1Url', '',
    'processImage2Url', '',
    'processImage3Url', '',
    'trustImageUrl', ''
  ),
  now()
)
on conflict (slug) do update
set
  title = excluded.title,
  brand_id = excluded.brand_id,
  treatment_id = excluded.treatment_id,
  package_id = excluded.package_id,
  branch_id = excluded.branch_id,
  form_id = excluded.form_id,
  template_key = excluded.template_key,
  mode = excluded.mode,
  status = excluded.status,
  content_json = excluded.content_json,
  image_assets_json = excluded.image_assets_json,
  published_at = coalesce(public.landing_pages.published_at, excluded.published_at),
  updated_at = now();

insert into public.landing_page_versions (
  id,
  page_id,
  version_number,
  status,
  content_json,
  image_assets_json
)
select
  '77777777-7777-4777-8777-777777777771',
  id,
  1,
  'published',
  content_json,
  image_assets_json
from public.landing_pages
where slug = 'alyssa-main-trial-offer'
on conflict (page_id, version_number) do update
set
  status = excluded.status,
  content_json = excluded.content_json,
  image_assets_json = excluded.image_assets_json;

update public.landing_pages
set
  published_version_id = '77777777-7777-4777-8777-777777777771',
  status = 'published',
  published_at = coalesce(published_at, now()),
  updated_at = now()
where slug = 'alyssa-main-trial-offer';
