-- Review obvious internal test leads before excluding or deleting anything.
-- This is read-only. Run it first and export/backup any rows before cleanup.

with suspected_test_leads as (
  select
    leads.id,
    leads.created_at,
    leads.customer_name,
    leads.phone,
    leads.normalized_phone,
    leads.form_id,
    leads.brand_id,
    leads.treatment_id,
    leads.package_id,
    leads.branch_id,
    leads.source_snapshot_id,
    leads.lead_status,
    leads.payment_status,
    leads.booking_status
  from public.leads
  where
    coalesce(leads.customer_name, '') ilike any (array[
      '%TEST%',
      '%FINAL TEST%',
      '%COOKIE TEST%',
      '%SERVER ATTR TEST%',
      '%LOCKED ATTR TEST%',
      '%INLINE BOOTSTRAP TEST%',
      '%LH BACKUP TEST%',
      '%LH MIXED TEST%',
      '%ALYSSA WIX TEST%',
      '%DIRECT TEST%',
      '%UTM TEST%'
    ])
    or regexp_replace(coalesce(leads.phone, leads.normalized_phone, ''), '\D', '', 'g')
      between '91234567' and '91234599'
)
select
  suspected_test_leads.*,
  brands.name as brand_name,
  treatments.name as treatment_name,
  packages.name as package_name,
  branches.name as branch_name,
  source.utm_source,
  source.utm_medium,
  source.utm_campaign,
  source.utm_content,
  source.fbclid,
  source.current_page_url,
  source.landing_page_url
from suspected_test_leads
left join public.brands on brands.id = suspected_test_leads.brand_id
left join public.treatments on treatments.id = suspected_test_leads.treatment_id
left join public.packages on packages.id = suspected_test_leads.package_id
left join public.branches on branches.id = suspected_test_leads.branch_id
left join public.lead_source_snapshots source
  on source.id = suspected_test_leads.source_snapshot_id
order by suspected_test_leads.created_at desc;
