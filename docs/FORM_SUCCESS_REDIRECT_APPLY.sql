-- Optional per-form thank-you redirect settings for LaunchHub embeds.
-- Review in Supabase SQL editor before applying. Do not run blindly.

alter table public.forms
  add column if not exists conversion_mode text not null default 'form_submit_pixel',
  add column if not exists success_redirect_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'forms_conversion_mode_check'
  ) then
    alter table public.forms
      add constraint forms_conversion_mode_check
      check (conversion_mode in ('form_submit_pixel', 'thank_you_redirect'));
  end if;
end $$;

-- Ineffable $388 form example.
-- This keeps the lead save in LaunchHub, then sends the browser to Wix Thank You.
update public.forms
set
  conversion_mode = 'thank_you_redirect',
  success_redirect_url = 'https://www.ineffablebeautyhk.com/thank-you?submitted=1&treatment=gentle-pore-care&value=388',
  updated_at = now()
where public_form_token = 'ineffable-beauty-388-3-form-4f4a18';
