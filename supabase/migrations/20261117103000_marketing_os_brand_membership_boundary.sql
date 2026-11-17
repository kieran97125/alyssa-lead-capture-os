-- First data-plane boundary: a member and its granted Brand must belong to
-- the same customer. This does not qualify the remaining business data plane.
set local lock_timeout = '5s';

alter table public.workspace_members
  add constraint workspace_members_workspace_identity_key unique (workspace_id, id);
alter table public.brands
  add constraint brands_workspace_identity_key unique (workspace_id, id);

alter table public.workspace_member_brand_access add column workspace_id uuid;
-- Never silently reassign a mismatched existing grant. NOT NULL below aborts
-- the entire migration if existing ownership cannot be proven from both ends.
update public.workspace_member_brand_access a
set workspace_id = m.workspace_id
from public.workspace_members m, public.brands b
where a.member_id = m.id and a.brand_id = b.id and m.workspace_id = b.workspace_id;
alter table public.workspace_member_brand_access alter column workspace_id set not null;
alter table public.workspace_member_brand_access
  add constraint member_brand_access_member_workspace_fk
    foreign key (workspace_id, member_id)
    references public.workspace_members(workspace_id, id) on delete cascade,
  add constraint member_brand_access_brand_workspace_fk
    foreign key (workspace_id, brand_id)
    references public.brands(workspace_id, id) on delete cascade;
create index member_brand_access_workspace_member_idx
  on public.workspace_member_brand_access(workspace_id, member_id);
create index member_brand_access_workspace_brand_idx
  on public.workspace_member_brand_access(workspace_id, brand_id);

-- Existing invitation/permission RPCs omit workspace_id. Derive it from the
-- actual member, never a global customer default. Composite FKs enforce both
-- ends, including concurrent parent moves, after this compatibility step.
create function public.bind_marketing_brand_access_workspace() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare member_workspace uuid;
begin
  select workspace_id into member_workspace
  from public.workspace_members where id = new.member_id;
  if member_workspace is null then
    raise exception 'Member workspace unavailable' using errcode = '23503';
  end if;
  if new.workspace_id is not null and new.workspace_id <> member_workspace then
    raise exception 'Member workspace mismatch' using errcode = '23503';
  end if;
  new.workspace_id := member_workspace;
  return new;
end $$;
revoke all on function public.bind_marketing_brand_access_workspace() from public, anon, authenticated;
create trigger marketing_brand_access_workspace
before insert or update of member_id, brand_id, workspace_id
on public.workspace_member_brand_access
for each row execute function public.bind_marketing_brand_access_workspace();

comment on column public.workspace_member_brand_access.workspace_id is
  'Customer identity derived from the member and constrained against both member and Brand. Additional customer admission remains closed.';
