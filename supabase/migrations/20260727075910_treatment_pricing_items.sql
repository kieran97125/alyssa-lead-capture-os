-- Structured treatment pricing and form-scoped item selection.
-- Existing forms remain fixed to their current default package.

alter table public.packages
  add column if not exists group_name text null,
  add column if not exists display_order integer not null default 0;

alter table public.forms
  add column if not exists package_selection_mode text not null default 'fixed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'packages_display_order_check'
      and conrelid = 'public.packages'::regclass
  ) then
    alter table public.packages
      add constraint packages_display_order_check
      check (display_order >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'forms_package_selection_mode_check'
      and conrelid = 'public.forms'::regclass
  ) then
    alter table public.forms
      add constraint forms_package_selection_mode_check
      check (package_selection_mode in ('fixed', 'customer_choice'));
  end if;
end
$$;

create table if not exists public.form_packages (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  is_default boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_packages_display_order_check check (display_order >= 0),
  unique (form_id, package_id)
);

create index if not exists packages_treatment_status_order_idx
  on public.packages(treatment_id, status, display_order, created_at);

create index if not exists form_packages_form_active_order_idx
  on public.form_packages(form_id, is_active, display_order, created_at);

create index if not exists form_packages_package_id_idx
  on public.form_packages(package_id);

create unique index if not exists form_packages_one_default_idx
  on public.form_packages(form_id)
  where is_default and is_active;

insert into public.form_packages (
  form_id,
  package_id,
  is_default,
  is_active,
  display_order
)
select
  forms.id,
  forms.default_package_id,
  true,
  true,
  0
from public.forms
where forms.default_package_id is not null
on conflict (form_id, package_id) do update
set
  is_default = true,
  is_active = true,
  display_order = 0,
  updated_at = now();

alter table public.form_packages enable row level security;
alter table public.form_packages force row level security;

revoke all on table public.form_packages from public;
revoke all on table public.form_packages from anon;
revoke all on table public.form_packages from authenticated;
grant select, insert, update, delete on table public.form_packages to service_role;

comment on column public.packages.group_name is
  'Optional customer-facing plan group, for example 2-year plan or permanent.';
comment on column public.packages.display_order is
  'Stable item order inside a treatment pricing list.';
comment on column public.forms.package_selection_mode is
  'fixed keeps one package; customer_choice exposes form_packages to the visitor.';
comment on table public.form_packages is
  'Server-managed allowlist of pricing items that a public form may accept.';
