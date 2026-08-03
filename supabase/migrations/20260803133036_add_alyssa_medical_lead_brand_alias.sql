-- Keep Alyssa Enterprise's live Lead Sheet labels isolated in source
-- configuration. Growth OS Core continues to use governed brand records.
update public.marketing_data_sources
set
  configuration = jsonb_set(
    jsonb_set(
      configuration,
      '{brandAliases}',
      coalesce(configuration -> 'brandAliases', '{}'::jsonb) ||
        jsonb_build_object(
          'Alyssa Medical', 'am',
          'Alyssa醫療', 'am',
          'Alyssa 醫療', 'am'
        ),
      true
    ),
    '{treatmentAliases}',
    coalesce(
      (
        select jsonb_agg(
          case
            when alias ->> 'label' in ('Julaine 緻麗顏', 'XEOMIN')
              then jsonb_set(alias, '{brand}', to_jsonb('AM'::text), true)
            else alias
          end
          order by ordinal
        )
        from jsonb_array_elements(
          coalesce(
            configuration -> 'treatmentAliases',
            '[]'::jsonb
          )
        ) with ordinality as entries(alias, ordinal)
      ),
      '[]'::jsonb
    ),
    true
  ),
  updated_at = now()
where provider_key = 'google_sheets'
  and configuration ->> 'sourceProfile' = 'alyssa_workspace_lead_funnel';
