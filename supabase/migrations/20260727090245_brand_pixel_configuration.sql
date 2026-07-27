-- Brand-scoped Meta Pixel configuration.
--
-- Pixel IDs are public identifiers, not credentials. They are stored on the
-- brand so Landing Pages, public forms and generated Wix embeds all resolve the
-- same tracking configuration without per-page code changes.

alter table public.brands
  add column if not exists meta_pixel_id text null,
  add column if not exists meta_pixel_pageview_on_embed boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brands_meta_pixel_id_check'
      and conrelid = 'public.brands'::regclass
  ) then
    alter table public.brands
      add constraint brands_meta_pixel_id_check
      check (
        meta_pixel_id is null
        or meta_pixel_id ~ '^[0-9]{5,30}$'
      );
  end if;
end
$$;

comment on column public.brands.meta_pixel_id is
  'Public Meta Pixel identifier used by LaunchHub pages, forms and generated embeds.';

comment on column public.brands.meta_pixel_pageview_on_embed is
  'When true, generated Wix embeds send one outer-page PageView. Keep false when the host website already owns PageView.';
