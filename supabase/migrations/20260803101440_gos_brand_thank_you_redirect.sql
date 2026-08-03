-- Make the GOS-owned Wix thank-you page the canonical conversion destination.
-- Existing form IDs, public tokens, treatment/package links and lead data remain unchanged.

update public.brands
set
  default_thank_you_url = 'https://www.gosbeauty.com/thank-you',
  updated_at = now()
where lower(slug) in ('gos', 'gos-beauty', 'gosbeauty');

with gos_form_redirects as (
  select
    forms.id,
    concat(
      'https://www.gosbeauty.com/thank-you?submitted=1&treatment=',
      coalesce(
        nullif(
          regexp_replace(lower(coalesce(treatments.slug, '')), '[^a-z0-9_-]+', '-', 'g'),
          ''
        ),
        'offer'
      ),
      case
        when coalesce(packages.promo_price, packages.original_price) is null
          then ''
        else concat(
          '&value=',
          round(coalesce(packages.promo_price, packages.original_price))::text
        )
      end
    ) as success_redirect_url
  from public.forms
  join public.brands on brands.id = forms.brand_id
  left join public.treatments on treatments.id = forms.default_treatment_id
  left join public.packages on packages.id = forms.default_package_id
  where lower(brands.slug) in ('gos', 'gos-beauty', 'gosbeauty')
)
update public.forms
set
  conversion_mode = 'thank_you_redirect',
  success_redirect_url = gos_form_redirects.success_redirect_url,
  allowed_domains = array(
    select distinct candidate.origin
    from unnest(
      coalesce(public.forms.allowed_domains, '{}'::text[]) ||
      array[
        'https://go.beautytrialhk.com',
        'https://www.gosbeauty.com',
        'https://gosbeauty.com'
      ]::text[]
    ) as candidate(origin)
    where lower(rtrim(candidate.origin, '/')) not in (
      'https://www.alyssa.hk',
      'https://alyssa.hk'
    )
    order by candidate.origin
  ),
  updated_at = now()
from gos_form_redirects
where public.forms.id = gos_form_redirects.id;

do $$
begin
  if exists (
    select 1
    from public.forms
    join public.brands on brands.id = forms.brand_id
    where lower(brands.slug) in ('gos', 'gos-beauty', 'gosbeauty')
      and (
        forms.conversion_mode <> 'thank_you_redirect'
        or forms.success_redirect_url is null
        or forms.success_redirect_url !~* '^https://(www\.)?gosbeauty\.com/thank-you(?:[?#]|$)'
        or not array[
          'https://go.beautytrialhk.com',
          'https://www.gosbeauty.com',
          'https://gosbeauty.com'
        ]::text[] <@ forms.allowed_domains
        or exists (
          select 1
          from unnest(forms.allowed_domains) as origin(value)
          where lower(rtrim(origin.value, '/')) in (
            'https://www.alyssa.hk',
            'https://alyssa.hk'
          )
        )
      )
  ) then
    raise exception 'GOS form redirect alignment failed';
  end if;
end
$$;
