begin;

create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  tag_key text not null,
  label text not null,
  color_key text not null default 'slate',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_slug, tag_key)
);

create table if not exists public.crm_contact_tags (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  tag_id uuid not null references public.crm_tags(id) on delete cascade,
  added_by text,
  created_at timestamptz not null default now(),
  unique (contact_id, tag_id)
);

alter table public.crm_contacts
  add column if not exists assigned_to text,
  add column if not exists priority text not null default 'normal',
  add column if not exists lifecycle_status text not null default 'new',
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists duplicate_review_status text not null default 'clear';

alter table public.crm_contacts drop constraint if exists crm_contacts_priority_check;
alter table public.crm_contacts add constraint crm_contacts_priority_check
  check (priority in ('low','normal','high','urgent'));
alter table public.crm_contacts drop constraint if exists crm_contacts_lifecycle_status_check;
alter table public.crm_contacts add constraint crm_contacts_lifecycle_status_check
  check (lifecycle_status in ('new','contacting','waiting_customer','waiting_branch','booked','payment_pending','paid','showed','no_show','lost'));
alter table public.crm_contacts drop constraint if exists crm_contacts_duplicate_review_status_check;
alter table public.crm_contacts add constraint crm_contacts_duplicate_review_status_check
  check (duplicate_review_status in ('clear','possible_duplicate','reviewed','merged'));

create table if not exists public.crm_template_mappings (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  mapping_key text not null,
  template_name text not null,
  use_case text not null,
  language_code text not null default 'zh_HK',
  variable_map jsonb not null default '{}'::jsonb,
  preview_body text,
  enabled boolean not null default true,
  approval_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_slug, mapping_key)
);

alter table public.crm_template_mappings drop constraint if exists crm_template_mappings_approval_status_check;
alter table public.crm_template_mappings add constraint crm_template_mappings_approval_status_check
  check (approval_status in ('draft','pending_meta','approved','rejected','paused'));

create table if not exists public.crm_automation_rules (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  rule_name text not null,
  trigger_key text not null,
  conditions_json jsonb not null default '{}'::jsonb,
  actions_json jsonb not null default '[]'::jsonb,
  mode text not null default 'simulation',
  enabled boolean not null default false,
  last_simulated_at timestamptz,
  last_run_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_automation_rules drop constraint if exists crm_automation_rules_mode_check;
alter table public.crm_automation_rules add constraint crm_automation_rules_mode_check
  check (mode in ('simulation','live'));

create table if not exists public.crm_payment_records (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.crm_lead_cases(id) on delete set null,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  source_lead_id uuid references public.leads(id) on delete set null,
  brand_slug text not null,
  payment_required boolean not null default false,
  payment_type text not null default 'full',
  amount numeric(12,2),
  currency text not null default 'HKD',
  status text not null default 'not_requested',
  method text,
  external_reference text,
  proof_url text,
  customer_submitted_at timestamptz,
  cs_verified_at timestamptz,
  account_verified_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  note text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_payment_records drop constraint if exists crm_payment_records_payment_type_check;
alter table public.crm_payment_records add constraint crm_payment_records_payment_type_check
  check (payment_type in ('full','deposit','manual'));
alter table public.crm_payment_records drop constraint if exists crm_payment_records_status_check;
alter table public.crm_payment_records add constraint crm_payment_records_status_check
  check (status in ('not_required','not_requested','pending','proof_submitted','verifying','paid','failed','expired','refunded','cancelled'));

create table if not exists public.crm_sla_policies (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  policy_key text not null,
  label text not null,
  threshold_minutes integer not null,
  queue_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_slug, policy_key)
);

create index if not exists crm_contacts_assignment_idx on public.crm_contacts(assigned_to, next_follow_up_at);
create index if not exists crm_contacts_lifecycle_idx on public.crm_contacts(lifecycle_status, priority);
create index if not exists crm_contact_tags_contact_idx on public.crm_contact_tags(contact_id);
create index if not exists crm_automation_rules_brand_idx on public.crm_automation_rules(brand_slug, enabled);
create index if not exists crm_payment_records_queue_idx on public.crm_payment_records(brand_slug, status, due_at);
create index if not exists crm_template_mappings_brand_idx on public.crm_template_mappings(brand_slug, enabled);

alter table public.crm_tags enable row level security;
alter table public.crm_contact_tags enable row level security;
alter table public.crm_template_mappings enable row level security;
alter table public.crm_automation_rules enable row level security;
alter table public.crm_payment_records enable row level security;
alter table public.crm_sla_policies enable row level security;

insert into public.crm_tags (brand_slug, tag_key, label, color_key, description)
values
  ('ineffable','new_customer','新客','indigo','首次登記或首次接觸'),
  ('ineffable','high_intent','高意向','emerald','有明確療程及時間需求'),
  ('ineffable','waiting_confirmation','等待確認','amber','等待客人或門店確認'),
  ('ineffable','payment_pending','待付款','rose','已提出付款但未完成'),
  ('ineffable','no_show_followup','No-show 跟進','slate','需要重新聯絡安排'),
  ('alyssa','new_customer','新客','indigo','首次登記或首次接觸'),
  ('alyssa','high_intent','高意向','emerald','有明確療程及時間需求')
on conflict (brand_slug, tag_key) do update set
  label = excluded.label,
  color_key = excluded.color_key,
  description = excluded.description,
  updated_at = now();

insert into public.crm_template_mappings
  (brand_slug, mapping_key, template_name, use_case, language_code, variable_map, preview_body, approval_status)
values
  ('ineffable','first_contact','ib_first_contact','新 Lead 首次聯絡','zh_HK',
   '{"1":"customer_name","2":"treatment_name","3":"branch_name","4":"preferred_date","5":"preferred_time"}'::jsonb,
   '你好 {{1}}，多謝你登記 Ineffable Beauty 的 {{2}}。你提交的分店及偏好時間為 {{3}}、{{4}} {{5}}。請回覆「確認」，或直接告訴我們想更改的日期及時間。','draft'),
  ('ineffable','booking_confirmation','ib_booking_confirmation','CS 正式確認預約後發送','zh_HK',
   '{"1":"customer_name","2":"treatment_name","3":"confirmed_date","4":"confirmed_time","5":"branch_name"}'::jsonb,
   '你好 {{1}}，你的 Ineffable Beauty 預約已確認：{{2}}，{{3}} {{4}}，{{5}}。如需更改，請直接回覆通知我們。','draft'),
  ('ineffable','booking_reminder','ib_booking_reminder','預約前提醒','zh_HK',
   '{"1":"customer_name","2":"treatment_name","3":"confirmed_date","4":"confirmed_time","5":"branch_name"}'::jsonb,
   '你好 {{1}}，溫馨提示你已預約 Ineffable Beauty：{{2}}，{{3}} {{4}}，{{5}}。如未能出席，請盡早回覆。','draft')
on conflict (brand_slug, mapping_key) do update set
  template_name = excluded.template_name,
  use_case = excluded.use_case,
  variable_map = excluded.variable_map,
  preview_body = excluded.preview_body,
  updated_at = now();

insert into public.crm_automation_rules
  (brand_slug, rule_name, trigger_key, conditions_json, actions_json, mode, enabled, created_by)
select * from (values
  ('ineffable','新 Lead 首次聯絡模擬','form_submitted', '{"brand":"ineffable"}'::jsonb, '[{"action":"assign_queue","value":"unassigned"},{"action":"add_tag","value":"new_customer"},{"action":"queue_template","value":"first_contact"}]'::jsonb, 'simulation', true, 'system'),
  ('ineffable','客人確認資料模擬','inbound_keyword', '{"keywords":["確認","confirm"]}'::jsonb, '[{"action":"set_lifecycle","value":"waiting_branch"},{"action":"notify_cs"}]'::jsonb, 'simulation', true, 'system'),
  ('ineffable','預約前提醒模擬','booking_reminder_due', '{}'::jsonb, '[{"action":"queue_template","value":"booking_reminder"}]'::jsonb, 'simulation', true, 'system')
) as seed(brand_slug, rule_name, trigger_key, conditions_json, actions_json, mode, enabled, created_by)
where not exists (
  select 1 from public.crm_automation_rules r
  where r.brand_slug = seed.brand_slug and r.rule_name = seed.rule_name
);

insert into public.crm_sla_policies (brand_slug, policy_key, label, threshold_minutes, queue_key)
values
  ('ineffable','first_contact','新 Lead 首次聯絡',10,'uncontacted'),
  ('ineffable','customer_reply','客人回覆後處理',15,'waiting_cs'),
  ('ineffable','booking_confirmation','等待正式確認預約',60,'waiting_branch'),
  ('ineffable','payment_verification','付款證明核實',60,'payment_verification')
on conflict (brand_slug, policy_key) do update set
  label = excluded.label,
  threshold_minutes = excluded.threshold_minutes,
  queue_key = excluded.queue_key,
  updated_at = now();

select 'crm_tags' as section, count(*) as row_count from public.crm_tags
union all select 'crm_template_mappings', count(*) from public.crm_template_mappings
union all select 'crm_automation_rules', count(*) from public.crm_automation_rules
union all select 'crm_payment_records', count(*) from public.crm_payment_records
union all select 'crm_sla_policies', count(*) from public.crm_sla_policies;

commit;