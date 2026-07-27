-- Alyssa LaunchHub Demand Signals MVP.
-- Kairvo is a product reference only: these tables are native to Alyssa and
-- intentionally have no cross-project IDs, foreign data wrappers or API links.

create table if not exists public.demand_signal_taxonomy (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  signal_type text not null,
  normalized_tag text not null,
  label text not null,
  description text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_signal_taxonomy_type_check
    check (signal_type in ('need', 'objection', 'price', 'results', 'trust', 'booking_barrier')),
  constraint demand_signal_taxonomy_status_check check (status in ('active', 'archived')),
  unique (brand_id, signal_type, normalized_tag)
);

create table if not exists public.demand_signals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  signal_type text not null,
  exact_quote text not null,
  normalized_tag text not null,
  summary text null,
  source_type text not null,
  status text not null default 'new',
  confidence numeric(4,3) not null default 0.500,
  occurred_at timestamptz not null default now(),
  lead_id uuid null references public.leads(id) on delete set null,
  contact_id uuid null references public.contacts(id) on delete set null,
  form_id uuid null references public.forms(id) on delete set null,
  treatment_id uuid null references public.treatments(id) on delete set null,
  reviewed_at timestamptz null,
  reviewed_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_signals_type_check
    check (signal_type in ('need', 'objection', 'price', 'results', 'trust', 'booking_barrier')),
  constraint demand_signals_source_check
    check (source_type in ('whatsapp', 'lead_form', 'crm', 'manual')),
  constraint demand_signals_status_check
    check (status in ('new', 'reviewed', 'applied', 'validated', 'rejected')),
  constraint demand_signals_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint demand_signals_exact_quote_length_check
    check (char_length(btrim(exact_quote)) between 2 and 2000),
  unique (id, brand_id)
);

create table if not exists public.demand_signal_source_refs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  signal_id uuid not null,
  source_type text not null,
  source_record_id text not null,
  lead_id uuid null references public.leads(id) on delete set null,
  contact_id uuid null references public.contacts(id) on delete set null,
  form_id uuid null references public.forms(id) on delete set null,
  treatment_id uuid null references public.treatments(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint demand_signal_source_refs_signal_brand_fk
    foreign key (signal_id, brand_id)
    references public.demand_signals(id, brand_id)
    on delete cascade,
  constraint demand_signal_source_refs_source_check
    check (source_type in ('whatsapp', 'lead_form', 'crm', 'manual')),
  -- Form and WhatsApp retries are idempotent. Manual captures use a random ID.
  unique (brand_id, source_type, source_record_id)
);

create table if not exists public.demand_signal_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  asset_type text not null,
  title text not null,
  content_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  landing_page_id uuid null references public.landing_pages(id) on delete set null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_signal_assets_type_check
    check (asset_type in ('creative_brief', 'faq', 'ad_hook', 'offer_idea', 'landing_page_message', 'system_card')),
  constraint demand_signal_assets_status_check
    check (status in ('draft', 'reviewed', 'applied', 'archived')),
  unique (id, brand_id)
);

create table if not exists public.demand_signal_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  signal_id uuid not null,
  asset_id uuid not null,
  created_at timestamptz not null default now(),
  constraint demand_signal_asset_links_signal_brand_fk
    foreign key (signal_id, brand_id) references public.demand_signals(id, brand_id) on delete cascade,
  constraint demand_signal_asset_links_asset_brand_fk
    foreign key (asset_id, brand_id) references public.demand_signal_assets(id, brand_id) on delete cascade,
  unique (brand_id, signal_id, asset_id)
);

alter table public.forms
  add column if not exists demand_signal_question_enabled boolean not null default false,
  add column if not exists demand_signal_question text null,
  add column if not exists demand_signal_question_required boolean not null default false;

create index if not exists demand_signals_brand_occurred_idx
  on public.demand_signals(brand_id, occurred_at desc);
create index if not exists demand_signals_brand_type_status_idx
  on public.demand_signals(brand_id, signal_type, status, occurred_at desc);
create index if not exists demand_signals_brand_tag_idx
  on public.demand_signals(brand_id, normalized_tag, occurred_at desc);
create index if not exists demand_signals_lead_idx
  on public.demand_signals(lead_id) where lead_id is not null;
create index if not exists demand_signal_source_refs_lead_idx
  on public.demand_signal_source_refs(brand_id, lead_id) where lead_id is not null;
create index if not exists demand_signal_assets_brand_status_idx
  on public.demand_signal_assets(brand_id, status, updated_at desc);
create index if not exists demand_signal_asset_links_signal_idx
  on public.demand_signal_asset_links(brand_id, signal_id);

insert into public.demand_signal_taxonomy (
  brand_id, signal_type, normalized_tag, label, description
)
select brands.id, seed.signal_type, seed.normalized_tag, seed.label, seed.description
from public.brands
cross join (
  values
    ('need', 'personalised_recommendation', '個人化建議', '想知道邊種方案較適合自己。'),
    ('need', 'skin_or_body_goal', '效果目標', '客人描述想改善的狀況或目標。'),
    ('objection', 'safety_concern', '安全／副作用疑慮', '對安全、恢復期或副作用有疑問。'),
    ('objection', 'pain_concern', '痛感疑慮', '擔心過程痛楚或不適。'),
    ('price', 'price_comparison', '價格比較', '正在比較價格或價值。'),
    ('price', 'budget_limit', '預算限制', '有明確預算或付款考慮。'),
    ('results', 'results_timeline', '見效時間', '想知道幾耐見效。'),
    ('results', 'results_proof', '效果證明', '要求案例、相片或其他效果證明。'),
    ('trust', 'professional_credibility', '專業信任', '關注資歷、設備或專業度。'),
    ('trust', 'authentic_review', '真實評價', '需要真實客人評價或口碑。'),
    ('booking_barrier', 'schedule_fit', '時間不合', '可選時間未能配合。'),
    ('booking_barrier', 'location_fit', '地點不合', '分店位置或交通構成阻力。'),
    ('booking_barrier', 'decision_delay', '未準備決定', '仍需考慮或與他人商量。')
) as seed(signal_type, normalized_tag, label, description)
on conflict (brand_id, signal_type, normalized_tag) do nothing;

alter table public.demand_signal_taxonomy enable row level security;
alter table public.demand_signal_taxonomy force row level security;
alter table public.demand_signals enable row level security;
alter table public.demand_signals force row level security;
alter table public.demand_signal_source_refs enable row level security;
alter table public.demand_signal_source_refs force row level security;
alter table public.demand_signal_assets enable row level security;
alter table public.demand_signal_assets force row level security;
alter table public.demand_signal_asset_links enable row level security;
alter table public.demand_signal_asset_links force row level security;

revoke all on table public.demand_signal_taxonomy from anon, authenticated;
revoke all on table public.demand_signals from anon, authenticated;
revoke all on table public.demand_signal_source_refs from anon, authenticated;
revoke all on table public.demand_signal_assets from anon, authenticated;
revoke all on table public.demand_signal_asset_links from anon, authenticated;

grant all on table public.demand_signal_taxonomy to service_role;
grant all on table public.demand_signals to service_role;
grant all on table public.demand_signal_source_refs to service_role;
grant all on table public.demand_signal_assets to service_role;
grant all on table public.demand_signal_asset_links to service_role;

comment on table public.demand_signals is
  'Brand-scoped, human-reviewed evidence captured by Alyssa LaunchHub from local first-party channels.';
comment on table public.demand_signal_source_refs is
  'Auditable local source lineage. No Kairvo or external Growth OS dependency.';
comment on table public.demand_signal_assets is
  'Controlled local drafts generated from reviewed signals; never auto-published.';
