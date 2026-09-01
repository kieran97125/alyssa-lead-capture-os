from __future__ import annotations

from pathlib import Path
import re
import textwrap


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return content.replace(old, new, 1)


def sub_once(
    content: str,
    pattern: str,
    replacement: str,
    label: str,
    flags: int = 0,
) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return updated


migration_path = (
    "supabase/migrations/"
    "20260901104500_creative_job_safe_delete_and_push_guard.sql"
)
migration = textwrap.dedent(
    '''
    -- Complete the Creative Job soft-delete lifecycle atomically.
    -- Daily work disappears, queued reminders are retired, unpublished Calendar
    -- drafts are removed, while published history and Audit evidence remain.

    create or replace function public.soft_delete_creative_job_and_retire_notifications(
      p_job_id uuid
    )
    returns table (
      deleted_at timestamptz,
      retired_notification_count integer,
      cancelled_delivery_count integer,
      calendar_item_removed boolean,
      published_calendar_preserved boolean
    )
    language plpgsql
    security definer
    set search_path = public, pg_temp
    as $$
    declare
      v_deleted_at timestamptz := now();
      v_calendar_item_id uuid;
      v_calendar_status text;
      v_retired_notification_count integer := 0;
      v_cancelled_delivery_count integer := 0;
      v_calendar_item_removed boolean := false;
      v_published_calendar_preserved boolean := false;
    begin
      select job.calendar_item_id
        into v_calendar_item_id
      from public.creative_jobs job
      where job.id = p_job_id
        and job.deleted_at is null
      for update;

      if not found then
        raise exception using
          errcode = 'P0002',
          message = 'creative_job_not_found_or_already_deleted';
      end if;

      if v_calendar_item_id is not null then
        select item.status
          into v_calendar_status
        from public.marketing_calendar_items item
        where item.id = v_calendar_item_id
        for update;

        if found and v_calendar_status = 'published' then
          v_published_calendar_preserved := true;
        elsif found then
          delete from public.marketing_calendar_items item
          where item.id = v_calendar_item_id;
          v_calendar_item_removed := found;
        end if;
      end if;

      update public.marketing_web_push_deliveries delivery
      set
        status = 'failed',
        next_attempt_at = v_deleted_at,
        last_error = 'creative_job_deleted',
        updated_at = v_deleted_at
      where delivery.notification_id in (
        select notification.id
        from public.marketing_notifications notification
        where notification.creative_job_id = p_job_id
      )
        and delivery.status in ('pending', 'retry', 'sending');
      get diagnostics v_cancelled_delivery_count = row_count;

      update public.marketing_notifications notification
      set
        is_read = true,
        read_at = coalesce(notification.read_at, v_deleted_at)
      where notification.creative_job_id = p_job_id
        and notification.is_read = false;
      get diagnostics v_retired_notification_count = row_count;

      update public.creative_jobs job
      set
        deleted_at = v_deleted_at,
        updated_at = v_deleted_at
      where job.id = p_job_id
        and job.deleted_at is null;

      if not found then
        raise exception using
          errcode = 'P0002',
          message = 'creative_job_not_found_or_already_deleted';
      end if;

      return query
      select
        v_deleted_at,
        v_retired_notification_count,
        v_cancelled_delivery_count,
        v_calendar_item_removed,
        v_published_calendar_preserved;
    end;
    $$;

    revoke all on function public.soft_delete_creative_job_and_retire_notifications(uuid)
      from public, anon, authenticated;
    grant execute on function public.soft_delete_creative_job_and_retire_notifications(uuid)
      to service_role;

    -- Do not claim a queued delivery when its Creative Job was already deleted.
    -- The dispatcher also performs an application-level guard for deliveries that
    -- were claimed immediately before the delete transaction committed.
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
        join public.marketing_notifications notification
          on notification.id = delivery.notification_id
        left join public.creative_jobs job
          on job.id = notification.creative_job_id
        where delivery.status in ('pending', 'retry')
          and delivery.next_attempt_at <= now()
          and (
            notification.creative_job_id is null
            or job.deleted_at is null
          )
        order by delivery.created_at
        for update of delivery skip locked
        limit greatest(1, least(coalesce(batch_size, 50), 100))
      ), claimed as (
        update public.marketing_web_push_deliveries delivery
        set
          status = 'sending',
          attempt_count = delivery.attempt_count + 1,
          updated_at = now()
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
    '''
).lstrip()
write(migration_path, migration)


# Replace the delete action with the atomic database lifecycle.
actions_path = "src/app/creative-jobs/actions.ts"
actions = read(actions_path)
delete_action = textwrap.dedent(
    '''
    export async function deleteCreativeJobAction(formData: FormData) {
      const access = await requireCreativeAction();
      const jobId = readString(formData, "jobId");
      const requestedReturnPath = safeCreativePath(
        readString(formData, "returnPath"),
        "/creative-jobs"
      );
      const returnPath = requestedReturnPath.startsWith(`/creative-jobs/${jobId}`)
        ? "/creative-jobs"
        : requestedReturnPath;
      const record = await getCreativeJobAccessRecord(jobId);
      if (
        !record.job ||
        !canEditCreativeJobMetadata(access, {
          brandId: String(record.job.brand_id),
          assigneeMemberId:
            typeof record.job.assignee_member_id === "string"
              ? record.job.assignee_member_id
              : null,
        })
      ) {
        redirectWithMessage(returnPath, false, "你未獲授權刪除呢張工作。" );
      }

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.rpc(
        "soft_delete_creative_job_and_retire_notifications",
        { p_job_id: jobId }
      );
      if (error) {
        console.warn("creative_job_delete_failed", {
          code: error.code,
          message: error.message,
          jobId,
        });
        const message = error.message.includes(
          "creative_job_not_found_or_already_deleted"
        )
          ? "呢張設計工作已經被刪除。"
          : "未能刪除設計工作，資料未有改動。";
        redirectWithMessage(returnPath, false, message);
      }

      const deletion = Array.isArray(data) ? data[0] : data;
      const deletedAt =
        deletion && typeof deletion.deleted_at === "string"
          ? deletion.deleted_at
          : new Date().toISOString();
      const retiredNotificationCount = Number(
        deletion?.retired_notification_count || 0
      );
      const cancelledDeliveryCount = Number(
        deletion?.cancelled_delivery_count || 0
      );
      const calendarItemRemoved = deletion?.calendar_item_removed === true;
      const publishedCalendarPreserved =
        deletion?.published_calendar_preserved === true;

      await writeCreativeAudit({
        jobId,
        access,
        action: "creative_job.deleted",
        before: {
          title: record.job.title,
          status: record.job.status,
          calendarItemId: record.job.calendar_item_id,
        },
        after: {
          deletedAt,
          retiredNotificationCount,
          cancelledDeliveryCount,
          calendarItemRemoved,
          publishedCalendarPreserved,
        },
      });
      revalidateCreative(jobId);
      redirectWithMessage(
        returnPath,
        true,
        publishedCalendarPreserved
          ? "設計工作已刪除；未送出提醒已取消，已 Published 日曆紀錄同 Audit 仍然保留。"
          : "設計工作已刪除；未送出提醒已取消，活動、版本同 Audit 紀錄仍然保留。"
      );
    }
    '''
).strip()
actions = sub_once(
    actions,
    r"export async function deleteCreativeJobAction\(formData: FormData\) \{.*?\n\}\n\nasync function requireCreativeSettings",
    delete_action + "\n\nasync function requireCreativeSettings",
    "deleteCreativeJobAction",
    flags=re.S,
)
write(actions_path, actions)


# Guard the delivery worker against a claimed notification whose Job was deleted.
edge_path = "supabase/functions/marketing-web-push-dispatch/index.ts"
edge = read(edge_path)
counts_marker = (
    '  const counts = { processed: 0, sent: 0, retry: 0, gone: 0, failed: 0 };\n'
)
active_job_block = textwrap.dedent(
    '''
      const creativeJobIds = [
        ...new Set(
          [...notifications.values()]
            .map((row) => row.creative_job_id)
            .filter((value): value is string => Boolean(value))
        ),
      ];
      const activeCreativeJobIds = new Set<string>();
      if (creativeJobIds.length > 0) {
        const creativeJobsResult = await supabase
          .from("creative_jobs")
          .select("id,deleted_at")
          .in("id", creativeJobIds);
        if (creativeJobsResult.error) {
          return new Response(
            JSON.stringify({ error: "creative_job_state_query_failed" }),
            { status: 500, headers: jsonHeaders }
          );
        }
        for (const row of creativeJobsResult.data ?? []) {
          if (!row.deleted_at) activeCreativeJobIds.add(String(row.id));
        }
      }

    '''
)
edge = replace_once(
    edge,
    counts_marker,
    active_job_block + counts_marker,
    "edge creative job active-state map",
)
url_marker = '    let url = notification.action_url || "/tasks";\n'
retire_claimed_block = textwrap.dedent(
    '''
        if (
          notification.creative_job_id &&
          !activeCreativeJobIds.has(notification.creative_job_id)
        ) {
          const retiredAt = new Date().toISOString();
          await Promise.all([
            supabase
              .from("marketing_web_push_deliveries")
              .update({
                status: "failed",
                next_attempt_at: retiredAt,
                last_error: "creative_job_deleted",
                updated_at: retiredAt,
              })
              .eq("id", delivery.id),
            supabase
              .from("marketing_notifications")
              .update({ is_read: true, read_at: retiredAt })
              .eq("id", notification.id),
          ]);
          counts.failed += 1;
          continue;
        }

    '''
)
edge = replace_once(
    edge,
    url_marker,
    retire_claimed_block + url_marker,
    "edge claimed Creative delivery retirement",
)
write(edge_path, edge)


# Extend the build contract so future refactors cannot remove safe deletion.
contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
migration_read = '''const safeDeleteMigration = read(
  "supabase/migrations/20260901104500_creative_job_safe_delete_and_push_guard.sql"
);
'''
contract = replace_once(
    contract,
    'const actions = read("src/app/creative-jobs/actions.ts");\n',
    'const actions = read("src/app/creative-jobs/actions.ts");\n' + migration_read,
    "safe delete migration contract import",
)
contract = replace_once(
    contract,
    'assert.match(actions, /設計工作已從 Job List 刪除/);\n',
    '''assert.match(actions, /soft_delete_creative_job_and_retire_notifications/);
assert.match(actions, /cancelledDeliveryCount/);
assert.match(actions, /publishedCalendarPreserved/);
assert.match(actions, /未送出提醒已取消/);
assert.match(
  safeDeleteMigration,
  /soft_delete_creative_job_and_retire_notifications/
);
assert.match(safeDeleteMigration, /delivery\.status in \('pending', 'retry', 'sending'\)/);
assert.match(safeDeleteMigration, /last_error = 'creative_job_deleted'/);
assert.match(safeDeleteMigration, /notification\.is_read = false/);
assert.match(safeDeleteMigration, /v_calendar_status = 'published'/);
assert.match(safeDeleteMigration, /claim_marketing_web_push_deliveries/);
''',
    "safe delete contract assertions",
)
contract = replace_once(
    contract,
    'assert.match(edgeFunction, /creative_overdue/);\n',
    '''assert.match(edgeFunction, /creative_overdue/);
assert.match(edgeFunction, /activeCreativeJobIds/);
assert.match(edgeFunction, /creative_job_state_query_failed/);
assert.match(edgeFunction, /last_error: "creative_job_deleted"/);
''',
    "dispatcher guard contract assertions",
)
write(contract_path, contract)


# Record the completed lifecycle locally as source evidence.
learning_path = (
    "docs/product-learning/entries/"
    "2026-09-01-creative-job-delete-notification-lifecycle.md"
)
learning = textwrap.dedent(
    '''
    # Creative Job delete and notification lifecycle

    ## Problem

    Creative Job deletion was hidden and ambiguously labelled, while the first New Job Server Action also exported a runtime object from a `"use server"` module. That caused a Production module-evaluation error after submission. A soft-deleted Job could additionally retain an unread notification or queued Web Push delivery created just before deletion.

    ## Product decision

    - Use the shared app-owned confirmation dialog in both Job List and Job detail placements.
    - Keep delete permission-gated and preserve the active filtered list after completion.
    - Move Server Action initial state to a neutral module so the `"use server"` file exports async actions only.
    - Execute Job soft deletion, unread-notification retirement, queued-delivery cancellation and linked Calendar cleanup atomically in Postgres.
    - Preserve a Published Calendar item as operational history; remove only an unpublished linked item.
    - Make the Push dispatcher recheck the linked Creative Job after claiming a delivery.
    - Preserve Creative activity, Brief versions and Audit history.

    ## Verification contract

    - Production build and Creative contracts inspect the Server Action boundary, safe-delete RPC, delivery statuses and dispatcher guard.
    - Storybook and deterministic desktop/mobile screenshots cover the confirmation states.
    - Playwright covers the real Creative Jobs route, list/detail delete controls, filter-preserving return path and Rich Brief behavior.
    - The reusable abstraction is indexed in the canonical `kieran97125/leadhub-source-os` Product Learning Log; Alyssa identity and production data remain isolated.

    ## Reusable rule

    A workflow item is not fully deleted merely because it disappears from a list. Deletion must cover the complete operational lifecycle: authorization, confirmation, active-view return, database state, pending notifications, linked unpublished schedules, published-history preservation, Audit evidence and runtime acceptance.
    '''
).lstrip()
write(learning_path, learning)


# Extend the ADR with the completed notification lifecycle and canonical sync.
adr_path = "docs/design-system/decisions/ADR-002-system-confirmation-dialog.md"
adr = read(adr_path)
appendix = textwrap.dedent(
    '''

    ## Operational deletion lifecycle

    The confirmation wording is backed by an atomic database function. It soft-deletes the Job, retires linked unread notifications, marks pending/retry/sending Web Push deliveries as failed with `creative_job_deleted`, removes an unpublished linked Calendar item and preserves a Published Calendar item. The Push dispatcher also rechecks Creative Job state after claiming deliveries.

    ## Product Learning Sync

    Reusable confirmation, soft-delete, notification-retirement and Server Action runtime-boundary learning is recorded in the canonical `kieran97125/leadhub-source-os` entry `2026-09-01-app-owned-destructive-action-lifecycle.md`. Client identity, users, domains, credentials and production records remain isolated.
    '''
)
if "## Operational deletion lifecycle" not in adr:
    adr = adr.rstrip() + appendix + "\n"
write(adr_path, adr)


changelog_path = "docs/design-system/CHANGELOG.md"
changelog = read(changelog_path)
needle = "- Delete remains permission-gated and uses soft deletion; Audit evidence is retained.\n"
replacement = (
    needle
    + "- Soft deletion atomically retires unread Creative notifications and pending Web Push deliveries.\n"
    + "- Unpublished linked Calendar items are removed; Published history is preserved.\n"
)
if "Soft deletion atomically retires unread Creative notifications" not in changelog:
    changelog = replace_once(
        changelog,
        needle,
        replacement,
        "design changelog safe delete bullets",
    )
write(changelog_path, changelog)

print("Creative Job runtime, delete, reminder, Calendar and Push lifecycle finalized.")
