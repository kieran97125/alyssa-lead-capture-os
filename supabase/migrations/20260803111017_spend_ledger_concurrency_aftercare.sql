-- Add optimistic concurrency to typed Spend writes so a stale browser cannot
-- silently overwrite a newer revision. Browser roles remain fully revoked.

create or replace function public.save_marketing_daily_spend(
  p_spend_date date,
  p_spend_type text,
  p_entries jsonb,
  p_actor_email text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry record;
  v_before jsonb;
  v_after jsonb;
  v_entry_id uuid;
  v_current_revision integer;
  v_saved_count integer := 0;
  v_deleted_count integer := 0;
  v_entry_count integer;
  v_brand_count integer;
begin
  if p_spend_date is null then
    raise exception 'spend_date_required';
  end if;
  if p_spend_date > (now() at time zone 'Asia/Hong_Kong')::date then
    raise exception 'future_spend_date_not_allowed';
  end if;
  if p_spend_type is null or p_spend_type not in (
    'meta_whatsapp',
    'meta_lead_form',
    'meta_website_form',
    'google_ads'
  ) then
    raise exception 'invalid_spend_type';
  end if;
  if jsonb_typeof(coalesce(p_entries, 'null'::jsonb)) <> 'array' then
    raise exception 'spend_entries_must_be_array';
  end if;
  if coalesce(trim(p_actor_email), '') = '' or length(trim(p_actor_email)) > 320 then
    raise exception 'spend_actor_required';
  end if;

  select count(*), count(distinct entries."brandId")
  into v_entry_count, v_brand_count
  from jsonb_to_recordset(p_entries) as entries(
    "brandId" uuid,
    amount numeric,
    note text,
    "expectedRevision" integer
  );

  if v_entry_count = 0 or v_entry_count > 50 then
    raise exception 'invalid_spend_entry_count';
  end if;
  if v_entry_count <> v_brand_count then
    raise exception 'duplicate_spend_brand';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as entries(
      "brandId" uuid,
      amount numeric,
      note text,
      "expectedRevision" integer
    )
    left join public.brands as brands on brands.id = entries."brandId"
    where entries."brandId" is null
      or brands.id is null
      or entries.amount < 0
      or entries.amount > 99999999.99
      or length(coalesce(entries.note, '')) > 500
      or entries."expectedRevision" < 1
  ) then
    raise exception 'invalid_spend_entry';
  end if;

  for v_entry in
    select
      entries."brandId" as brand_id,
      entries.amount,
      nullif(trim(entries.note), '') as note,
      entries."expectedRevision" as expected_revision
    from jsonb_to_recordset(p_entries) as entries(
      "brandId" uuid,
      amount numeric,
      note text,
      "expectedRevision" integer
    )
  loop
    v_before := null;
    v_after := null;
    v_entry_id := null;
    v_current_revision := null;

    select
      ledger.revision,
      jsonb_build_object(
        'id', ledger.id,
        'brandId', ledger.brand_id,
        'spendDate', ledger.spend_date,
        'spendType', ledger.spend_type,
        'amount', ledger.amount,
        'currency', ledger.currency,
        'entryMethod', ledger.entry_method,
        'note', ledger.note,
        'revision', ledger.revision,
        'updatedBy', ledger.updated_by_email,
        'updatedAt', ledger.updated_at
      )
    into v_current_revision, v_before
    from public.marketing_daily_spend_entries as ledger
    where ledger.brand_id = v_entry.brand_id
      and ledger.spend_date = p_spend_date
      and ledger.spend_type = p_spend_type
    for update;

    if v_before is null and v_entry.expected_revision is not null then
      raise exception 'stale_spend_entry:%', v_entry.brand_id;
    end if;
    if v_before is not null and (
      v_entry.expected_revision is null or
      v_entry.expected_revision <> v_current_revision
    ) then
      raise exception 'stale_spend_entry:%', v_entry.brand_id;
    end if;

    if v_entry.amount is null then
      if v_before is not null then
        delete from public.marketing_daily_spend_entries as ledger
        where ledger.brand_id = v_entry.brand_id
          and ledger.spend_date = p_spend_date
          and ledger.spend_type = p_spend_type
          and ledger.revision = v_entry.expected_revision
        returning ledger.id into v_entry_id;

        if v_entry_id is null then
          raise exception 'stale_spend_entry:%', v_entry.brand_id;
        end if;

        insert into public.marketing_command_center_audit (
          actor_email,
          action,
          entity_type,
          entity_id,
          brand_id,
          before_json,
          after_json
        ) values (
          trim(p_actor_email),
          'daily_spend.deleted',
          'marketing_daily_spend',
          v_entry_id::text,
          v_entry.brand_id,
          v_before,
          null
        );
        v_deleted_count := v_deleted_count + 1;
      end if;
    else
      insert into public.marketing_daily_spend_entries (
        brand_id,
        spend_date,
        spend_type,
        amount,
        currency,
        entry_method,
        source_reference,
        note,
        revision,
        created_by_email,
        updated_by_email,
        updated_at
      ) values (
        v_entry.brand_id,
        p_spend_date,
        p_spend_type,
        v_entry.amount,
        'HKD',
        'manual',
        null,
        v_entry.note,
        1,
        trim(p_actor_email),
        trim(p_actor_email),
        now()
      )
      on conflict (brand_id, spend_date, spend_type) do update
      set
        amount = excluded.amount,
        currency = excluded.currency,
        entry_method = 'manual',
        source_reference = null,
        note = excluded.note,
        revision = public.marketing_daily_spend_entries.revision + 1,
        updated_by_email = excluded.updated_by_email,
        updated_at = excluded.updated_at
      where v_entry.expected_revision is not null
        and public.marketing_daily_spend_entries.revision = v_entry.expected_revision
      returning
        marketing_daily_spend_entries.id,
        jsonb_build_object(
          'id', marketing_daily_spend_entries.id,
          'brandId', marketing_daily_spend_entries.brand_id,
          'spendDate', marketing_daily_spend_entries.spend_date,
          'spendType', marketing_daily_spend_entries.spend_type,
          'amount', marketing_daily_spend_entries.amount,
          'currency', marketing_daily_spend_entries.currency,
          'entryMethod', marketing_daily_spend_entries.entry_method,
          'note', marketing_daily_spend_entries.note,
          'revision', marketing_daily_spend_entries.revision,
          'updatedBy', marketing_daily_spend_entries.updated_by_email,
          'updatedAt', marketing_daily_spend_entries.updated_at
        )
      into v_entry_id, v_after;

      if v_entry_id is null then
        raise exception 'stale_spend_entry:%', v_entry.brand_id;
      end if;

      insert into public.marketing_command_center_audit (
        actor_email,
        action,
        entity_type,
        entity_id,
        brand_id,
        before_json,
        after_json
      ) values (
        trim(p_actor_email),
        case when v_before is null
          then 'daily_spend.created'
          else 'daily_spend.updated'
        end,
        'marketing_daily_spend',
        v_entry_id::text,
        v_entry.brand_id,
        v_before,
        v_after
      );
      v_saved_count := v_saved_count + 1;
    end if;
  end loop;

  update public.marketing_data_sources as sources
  set
    last_sync_at = now(),
    last_success_at = now(),
    last_error_summary = null,
    updated_at = now()
  where sources.provider_key = 'internal_ledger'
    and sources.configuration ->> 'dataset' = 'daily_spend_ledger'
    and sources.brand_id in (
      select entries."brandId"
      from jsonb_to_recordset(p_entries) as entries(
        "brandId" uuid,
        amount numeric,
        note text,
        "expectedRevision" integer
      )
    );

  return jsonb_build_object(
    'spendDate', p_spend_date,
    'spendType', p_spend_type,
    'savedCount', v_saved_count,
    'deletedCount', v_deleted_count,
    'entryCount', v_entry_count
  );
end;
$$;

revoke all on function public.save_marketing_daily_spend(date, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.save_marketing_daily_spend(date, text, jsonb, text)
  to service_role;

comment on function public.save_marketing_daily_spend(date, text, jsonb, text) is
  'Atomically saves changed typed Spend entries with optimistic revision checks and audit evidence. Null clears; zero is an explicit value; stale revisions fail the whole transaction.';
