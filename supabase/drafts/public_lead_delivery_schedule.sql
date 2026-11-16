-- Reviewed rollout recipe, NOT an automatic migration. No live changes are
-- authorized by this file. Execute only after explicit production authorization,
-- the additive capture migration, and successful application deployment.
-- Required encrypted Vault entries (configured separately after authorization):
--   public_lead_delivery_worker_url: verified, direct HTTPS production worker URL
--   public_lead_delivery_signing_secret: same production LEAD_DELIVERY_SIGNING_SECRET
-- The dedicated signing key must be >=32 characters, without surrounding spaces.
-- Never place credentials/client URLs in this source or in cron.job commands.
-- pg_net's queue can expose headers to database roles: only an endpoint-bound,
-- short-lived HMAC proof is queued, never the signing key or global CRON_SECRET.
-- No pg_net/Vault permission changes or paid scheduler upgrades are required.
begin;
do $preflight$
declare
  v_url text;
  v_secret text;
begin
  if not exists(select 1 from pg_extension where extname = 'pg_cron')
     or not exists(select 1 from pg_extension where extname = 'pg_net')
     or not exists(select 1 from pg_extension where extname = 'supabase_vault')
     or to_regprocedure('extensions.hmac(text,text,text)') is null
     or to_regprocedure('public.claim_public_lead_deliveries(uuid,integer)') is null then
    raise exception 'delivery_scheduler_dependencies_unavailable';
  end if;
  select decrypted_secret into strict v_url from vault.decrypted_secrets
    where name = 'public_lead_delivery_worker_url';
  select decrypted_secret into strict v_secret from vault.decrypted_secrets
    where name = 'public_lead_delivery_signing_secret';
  if v_url is null or v_url !~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}/api/cron/lead-deliveries$'
     or v_secret is null or length(v_secret) < 32 or v_secret <> btrim(v_secret)
     or v_secret ~ E'[\\r\\n]' then
    raise exception 'delivery_scheduler_configuration_invalid';
  end if;
  -- A named schedule updates idempotently for the same authorized job owner.
  -- Every dispatch re-reads and validates Vault values; rotation needs no SQL rewrite.
  perform cron.schedule('public-lead-delivery-recovery', '*/5 * * * *', $worker$
    do $dispatch$
    declare
      v_url text;
      v_secret text;
      v_timestamp text;
      v_signature text;
    begin
      select decrypted_secret into strict v_url from vault.decrypted_secrets
        where name = 'public_lead_delivery_worker_url';
      select decrypted_secret into strict v_secret from vault.decrypted_secrets
        where name = 'public_lead_delivery_signing_secret';
      if v_url is null or v_url !~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}/api/cron/lead-deliveries$'
         or v_secret is null or length(v_secret) < 32 or v_secret <> btrim(v_secret)
         or v_secret ~ E'[\\r\\n]' then
        raise exception 'delivery_scheduler_configuration_invalid';
      end if;
      v_timestamp := floor(extract(epoch from clock_timestamp()))::bigint::text;
      v_signature := encode(extensions.hmac(
        E'GET\n/api/cron/lead-deliveries\n' || v_timestamp, v_secret, 'sha256'), 'hex');
      perform net.http_get(
        url := v_url,
        headers := jsonb_build_object(
          'x-lead-delivery-timestamp', v_timestamp,
          'x-lead-delivery-signature', v_signature),
        timeout_milliseconds := 65000
      );
    end;
    $dispatch$;
  $worker$);
end;
$preflight$;
commit;

-- Verification after authorized enabling: confirm the exact production URL is
-- direct (no redirect), unsigned/expired requests return 401, valid proof returns
-- aggregate worker status, and delivered/blocked/uncertain outbox counts behave.
-- Inspect only job name/schedule/active state and HTTP status. pg_cron success
-- means the request was queued, not that the remote worker completed. Never read
-- or export decrypted Vault values or HTTP headers while inspecting health.
-- Proof freshness: <=60s old / <=15s future. Queue delays beyond that fail closed;
-- the next scheduled attempt recovers. A proof can dispatch only this bounded
-- delivery worker during that short window; database leases protect replayed calls.
-- Rollback scheduling: select cron.unschedule('public-lead-delivery-recovery');
-- Unscheduling does not cancel an already queued/in-flight HTTP request. Let its
-- bounded lease finish; retain the outbox evidence. Disable/rotate the dedicated
-- signing key separately if immediate authentication revocation is required.
