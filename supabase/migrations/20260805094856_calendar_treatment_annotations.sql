-- Add an optional treatment dimension to marketing calendar items so a
-- historical operational change can be aligned with brand and treatment
-- performance without copying customer-level data into reporting payloads.

alter table public.marketing_calendar_items
  add column if not exists treatment_id uuid null
    references public.treatments(id) on delete set null,
  add column if not exists treatment_label text null;

alter table public.marketing_calendar_items
  drop constraint if exists marketing_calendar_items_treatment_label_check;

alter table public.marketing_calendar_items
  add constraint marketing_calendar_items_treatment_label_check
    check (
      treatment_label is null
      or char_length(trim(treatment_label)) between 1 and 180
    );

create index if not exists marketing_calendar_items_treatment_date_idx
  on public.marketing_calendar_items(
    treatment_id,
    scheduled_date,
    brand_id
  )
  where treatment_id is not null;

comment on column public.marketing_calendar_items.treatment_id is
  'Optional stable treatment reference for an operational calendar item. A null value means the item applies to the whole brand.';

comment on column public.marketing_calendar_items.treatment_label is
  'Historical display snapshot used to align calendar annotations with the anonymous treatment-performance label active at the time.';
