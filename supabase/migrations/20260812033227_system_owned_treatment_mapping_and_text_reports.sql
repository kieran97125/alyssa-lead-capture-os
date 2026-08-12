create table public.treatment_mapping_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  item_code text not null,
  keywords text[] not null default '{}',
  output_label text not null,
  dashboard_label text not null,
  note text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  revision integer not null default 1,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_mapping_rules_item_code_check
    check (item_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$'),
  constraint treatment_mapping_rules_keywords_check
    check (cardinality(keywords) between 1 and 50),
  constraint treatment_mapping_rules_output_label_check
    check (length(trim(output_label)) between 1 and 2000),
  constraint treatment_mapping_rules_dashboard_label_check
    check (length(trim(dashboard_label)) between 1 and 180),
  constraint treatment_mapping_rules_note_check
    check (note is null or length(note) <= 1000),
  constraint treatment_mapping_rules_sort_order_check
    check (sort_order between 0 and 100000),
  constraint treatment_mapping_rules_revision_check
    check (revision > 0)
);

comment on table public.treatment_mapping_rules is
  'Growth OS source of truth for Lead Sheet treatment normalization and Dashboard classification. Google Sheets may retain a historical rule tab, but it is not authoritative.';

create unique index treatment_mapping_rules_brand_code_uidx
  on public.treatment_mapping_rules (brand_id, lower(item_code));
create index treatment_mapping_rules_active_order_idx
  on public.treatment_mapping_rules (enabled, sort_order, brand_id);

alter table public.treatment_mapping_rules enable row level security;
revoke all on table public.treatment_mapping_rules from anon, authenticated;
grant select, insert, update, delete on table public.treatment_mapping_rules to service_role;

create or replace function public.touch_treatment_mapping_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

create trigger treatment_mapping_rules_touch
before update on public.treatment_mapping_rules
for each row execute function public.touch_treatment_mapping_rule();

create or replace function public.audit_treatment_mapping_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  v_actor := coalesce(
    nullif(trim(case when tg_op = 'DELETE' then old.updated_by_email else new.updated_by_email end), ''),
    'system'
  );
  insert into public.marketing_command_center_audit (
    actor_email,
    action,
    entity_type,
    entity_id,
    brand_id,
    before_json,
    after_json
  ) values (
    v_actor,
    case tg_op
      when 'INSERT' then 'treatment_mapping.created'
      when 'UPDATE' then 'treatment_mapping.updated'
      else 'treatment_mapping.deleted'
    end,
    'treatment_mapping_rule',
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    case when tg_op = 'DELETE' then old.brand_id else new.brand_id end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger treatment_mapping_rules_audit
after insert or update or delete on public.treatment_mapping_rules
for each row execute function public.audit_treatment_mapping_rule();

create or replace function public.rebuild_treatment_mapping_cache()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aliases jsonb;
  v_updated integer;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', rules.dashboard_label,
        'brand', brands.name,
        'keywords', to_jsonb(rules.keywords)
      ) order by rules.sort_order, rules.created_at, rules.id
    ),
    '[]'::jsonb
  )
  into v_aliases
  from public.treatment_mapping_rules as rules
  join public.brands as brands on brands.id = rules.brand_id
  where rules.enabled = true;

  update public.marketing_data_sources as sources
  set
    configuration = jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(sources.configuration, '{}'::jsonb),
          '{treatmentAliases}',
          v_aliases,
          true
        ),
        '{treatmentMappingSource}',
        '"growth_os_system"'::jsonb,
        true
      ),
      '{treatmentMappingUpdatedAt}',
      to_jsonb(now()::text),
      true
    ),
    updated_at = now()
  where sources.provider_key = 'google_sheets'
    and sources.configuration ->> 'sourceProfile' = 'alyssa_workspace_lead_funnel';
  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'aliasCount', jsonb_array_length(v_aliases),
    'dataSourceCount', v_updated
  );
end;
$$;

revoke all on function public.rebuild_treatment_mapping_cache()
  from public, anon, authenticated;
grant execute on function public.rebuild_treatment_mapping_cache()
  to service_role;

create or replace function public.refresh_treatment_mapping_cache_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.rebuild_treatment_mapping_cache();
  return coalesce(new, old);
end;
$$;

create trigger treatment_mapping_rules_cache_refresh
after insert or update or delete on public.treatment_mapping_rules
for each statement execute function public.refresh_treatment_mapping_cache_trigger();

with seed(
  brand_slug,
  item_code,
  keywords,
  output_label,
  dashboard_label,
  note,
  sort_order
) as (
  values
  ('ineffable','ib-388-gentle-pore',array['388','針清','鉗清','柔清','暗瘡']::text[],'$388 柔清舒敏鉗清','$388 柔清舒敏鉗清','IB 主推；由 Sheet 搬入，對外標準統一使用「鉗清」。',10),
  ('ineffable','ib-588-dep',array['dep','nano','無針水光','水光']::text[],'$588 DEP 無針水光 Combo','$588 DEP 無針水光 Combo','IB 主推',20),
  ('ineffable','ib-588-slite',array['s-lite','slite','水感輕腿','輕腿']::text[],'$588 S-Lite 水感輕腿管理','$588 S-Lite 水感輕腿管理','IB 主推',30),
  ('ineffable','ib-780-btl-exion',array['btl','exion','膠原提拉','全面膠原']::text[],'$780 BTL Exion','$780 BTL Exion','IB 主推',40),
  ('alyssa','alyssa-988-facelift',array['facelift','face lift','蔡思貝','yanyan']::text[],'$988 Facelift','$988 Facelift','Alyssa 主推',50),
  ('alyssa','alyssa-780-slimcut',array['slimcut','slim cut','sulin','跑online']::text[],'$780 SlimCut','$780 SlimCut','Alyssa 主推',60),
  ('am','alyssa-julaine',array['julaine','poyi','kimi','麗珠蘭','JULÄINE']::text[],'免費咨詢 Julaine','免費咨詢 Julaine','Alyssa Medical',70),
  ('am','alyssa-xeomin',array['xeomin','heihei','瘦面針','瘦肩','瘦小腿','魚尾紋','眉心','抬頭紋','收鼻翼']::text[],E'優惠1：$999 魚尾紋/眉心/抬頭紋/收鼻翼 4選1\n優惠2：$1699 XEOMIN 瘦面針\n優惠3：$2999 XEOMIN 瘦肩/瘦小腿/自選1款','XEOMIN','Alyssa Medical',80),
  ('alyssa','alyssa-588-jiyuan28',array['肌源28','肌源 28','jiyuan28','jiyuan 28']::text[],'$588 肌源28','$588 肌源28','新項目',90),
  ('alyssa','alyssa-988-yanyan-face-pilates',array['Face Pilates']::text[],'$988 Facelift','$988 Facelift','新項目；原 Sheet 項目代號標準化為唯一 code。',100),
  ('gos-beauty','gos-pigmentation-skin-brightening',array['去斑','打斑','嫩膚','美白','色斑','雀斑','曬斑','暗沉','膚色不均','988']::text[],'GOS 去斑・嫩膚・美白｜HK$988','GOS 去斑・嫩膚・美白','GOS 主推',110),
  ('gos-beauty','gos-wart-mole-removal',array['脫疣','去疣','疣','脫癦','去癦','癦','脫痣','去痣','痣','肉粒','油脂粒','汗管瘤','皮膚瑕疵']::text[],E'脫疣｜其他位置｜HK$100／粒\n脫癦｜其他位置｜HK$100／粒\n脫痣｜其他位置｜HK$100／粒\n肉粒｜其他位置｜HK$100／粒\n油脂粒｜其他位置｜HK$100／粒\n汗管瘤｜其他位置｜HK$100／粒\n\n脫疣｜眼周位置｜HK$500／粒\n脫癦｜眼周位置｜HK$500／粒\n脫痣｜眼周位置｜HK$500／粒\n肉粒｜眼周位置｜HK$500／粒\n油脂粒｜眼周位置｜HK$500／粒\n汗管瘤｜眼周位置｜HK$500／粒','GOS 疣・癦・痣處理','GOS 主推',120),
  ('gos-beauty','gos-laser-hair-removal',array['激光脫毛','脫毛','三波長','冰感','兩年激脫','永久保養','腋下','Bikini','全腿','全手']::text[],E'兩年激脫計劃｜S・SMALL｜HK$990\n兩年激脫計劃｜M・MEDIUM｜HK$1,390\n兩年激脫計劃｜MP・MEDI-PREMIUM｜HK$1,690\n兩年激脫計劃｜L・LARGE｜HK$2,390\n\n永久保養計劃｜S・SMALL｜HK$9,900\n永久保養計劃｜M・MEDIUM｜HK$13,900\n永久保養計劃｜MP・MEDI-PREMIUM｜HK$16,900\n永久保養計劃｜L・LARGE｜HK$23,900','GOS 激光脫毛','GOS 主推',130),
  ('alyssa','alyssa-restylane',array['Restylane']::text[],'Restylane','Restylane','新項目；原 Sheet 重複使用 Face Pilates 項目代號，已修正為唯一 code。',140)
)
insert into public.treatment_mapping_rules (
  brand_id,
  item_code,
  keywords,
  output_label,
  dashboard_label,
  note,
  enabled,
  sort_order,
  created_by_email,
  updated_by_email
)
select
  brands.id,
  seed.item_code,
  seed.keywords,
  seed.output_label,
  seed.dashboard_label,
  seed.note,
  true,
  seed.sort_order,
  'growth-os-migration',
  'growth-os-migration'
from seed
join public.brands as brands on brands.slug = seed.brand_slug;

select public.rebuild_treatment_mapping_cache();

alter table public.marketing_report_snapshots
  drop constraint marketing_report_snapshots_output_format_check;
alter table public.marketing_report_snapshots
  add constraint marketing_report_snapshots_output_format_check
  check (output_format = any (array['pdf'::text, 'pptx'::text, 'txt'::text]));

comment on table public.marketing_report_snapshots is
  'Immutable, non-PII aggregate snapshots used to generate Growth OS PDF, PPTX and plain-text Dashboard reports.';
