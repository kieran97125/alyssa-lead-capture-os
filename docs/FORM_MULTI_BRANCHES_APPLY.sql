-- LaunchHub multi-branch forms
-- Apply this in Supabase before relying on multiple branches per public form.
-- Existing forms keep using forms.default_branch_id as the compatibility fallback.

create table if not exists public.form_branches (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  is_default boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (form_id, branch_id)
);

create index if not exists form_branches_form_id_idx
  on public.form_branches(form_id);

create index if not exists form_branches_branch_id_idx
  on public.form_branches(branch_id);

insert into public.form_branches (
  form_id,
  branch_id,
  is_default,
  is_active,
  display_order
)
select
  forms.id,
  forms.default_branch_id,
  true,
  true,
  0
from public.forms
where forms.default_branch_id is not null
on conflict (form_id, branch_id) do update
set
  is_default = true,
  is_active = true,
  display_order = 0;
