-- Reviewed rollout recipe, NOT an automatic migration.
-- Execute only after authorized production rollout, the additive capture migration,
-- and successful application deployment. No credentials or client URL belong here.
-- Required encrypted Vault entries:
--   public_lead_delivery_worker_url: exact HTTPS /api/cron/lead-deliveries URL
--   public_lead_delivery_cron_secret: same production CRON_SECRET, >= 32 characters
-- Vercel Hobby keeps its existing daily source-refresh job. Recovery uses the
-- already-installed pg_cron / pg_net / Vault capabilities, every five minutes.
begin;
do $preflight$
declare
  v_url text;
  v_secret text;
begin
  if not exists(select 1 from pg_extension where extname = 'pg_cron')
     or not exists(select 1 from pg_extension where extname = 'pg_net')
     or not exists(select 1 from pg_extension where extname = 'supabase_vault') then
    raise exception 'delivery_scheduler_dependencies_unavailable';
  end if;
  select decrypted_secret into strict v_url from vault.decrypted_secrets
    where name = 'public_lead_delivery_worker_url';
  select decrypted_secret into strict v_secret from vault.decrypted_secrets
    where name = 'public_lead_delivery_cron_secret';
  if v_url !~ '^https://[a-zA-Z0-9.-]+/api/cron/lead-deliveries$'
     or length(v_secret) < 32 then
    raise exception 'delivery_scheduler_configuration_invalid';
  end if;
  -- A named schedule is idempotent. No worker secret is embedded in cron.job.
  perform cron.schedule('public-lead-delivery-recovery', '*/5 * * * *', $worker$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets
        where name = 'public_lead_delivery_worker_url'),
      headers := jsonb_build_object('Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets
          where name = 'public_lead_delivery_cron_secret')),
      timeout_milliseconds := 55000
    );
  $worker$);
end;
$preflight$;
commit;

-- Verification after enabling: inspect only job name/schedule/active state and
-- worker HTTP status, never decrypted Vault values or HTTP authorization headers.
-- Rollback: select cron.unschedule('public-lead-delivery-recovery');
