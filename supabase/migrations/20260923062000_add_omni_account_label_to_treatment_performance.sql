alter table public.marketing_treatment_performance_daily
  add column if not exists account_label text;

comment on column public.marketing_treatment_performance_daily.account_label
  is 'Omni Account label captured from the Account-first Lead Sheet reporting dimension.';
