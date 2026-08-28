-- Install pg_net under the standard extensions ownership schema while it
-- continues to expose its request API in the dedicated net schema.

-- No Web Push deliveries existed during this one-time extension ownership
-- correction, so recreating pg_net cannot drop queued outbound requests.
drop extension if exists pg_net cascade;
create extension if not exists pg_net with schema extensions;

create or replace function public.request_marketing_web_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  target_url text;
  target_token text;
  request_id bigint;
begin
  select dispatch_url, dispatch_token
    into target_url, target_token
  from public.marketing_web_push_settings
  where id = 'primary';

  if target_url is null or target_token is null then
    return null;
  end if;

  select net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-growth-os-dispatch-token', target_token
    ),
    body := jsonb_build_object(
      'source', 'growth-os-postgres',
      'requestedAt', now()
    ),
    timeout_milliseconds := 15000
  ) into request_id;

  return request_id;
exception
  when others then
    raise warning 'marketing_web_push_dispatch_request_failed: %', sqlerrm;
    return null;
end;
$$;

revoke all on function public.request_marketing_web_push_dispatch()
  from public, anon, authenticated;
grant execute on function public.request_marketing_web_push_dispatch()
  to service_role;
