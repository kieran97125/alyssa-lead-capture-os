create or replace function public.claim_marketing_web_push_deliveries(
  batch_size integer default 50
)
returns table (
  id uuid,
  notification_id uuid,
  subscription_id uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select delivery.id
    from public.marketing_web_push_deliveries delivery
    where (
        delivery.status in ('pending', 'retry')
        and delivery.next_attempt_at <= now()
      )
      or (
        delivery.status = 'sending'
        and delivery.updated_at <= now() - interval '10 minutes'
      )
    order by delivery.created_at
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 50), 100))
  ), claimed as (
    update public.marketing_web_push_deliveries delivery
    set
      status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      updated_at = now(),
      last_error = case
        when delivery.status = 'sending'
          then 'recovered_stale_delivery_claim'
        else delivery.last_error
      end
    from candidates
    where delivery.id = candidates.id
    returning
      delivery.id,
      delivery.notification_id,
      delivery.subscription_id,
      delivery.attempt_count
  )
  select
    claimed.id,
    claimed.notification_id,
    claimed.subscription_id,
    claimed.attempt_count
  from claimed;
end;
$$;

revoke all on function public.claim_marketing_web_push_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_marketing_web_push_deliveries(integer)
  to service_role;
