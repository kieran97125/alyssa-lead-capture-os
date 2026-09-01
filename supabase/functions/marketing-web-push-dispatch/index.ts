import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import webpush from "npm:web-push@3.6.7";

type DeliveryRow = {
  id: string;
  notification_id: string;
  subscription_id: string;
  attempt_count: number;
};

type NotificationRow = {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  task_id: string | null;
  calendar_item_id: string | null;
  creative_job_id: string | null;
  action_url: string | null;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

function secureEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

function retryDelayMinutes(attempt: number) {
  return Math.min(60, Math.max(1, 2 ** Math.min(6, attempt)));
}

function isUrgent(type: string) {
  return [
    "task_assigned",
    "task_due_soon",
    "task_overdue",
    "calendar_published",
    "creative_assigned",
    "creative_priority_changed",
    "creative_due_soon",
    "creative_overdue",
    "creative_revision",
  ].includes(type);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "server_configuration_missing" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const settingsResult = await supabase
    .from("marketing_web_push_settings")
    .select("vapid_public_key,vapid_private_key,vapid_subject,dispatch_token")
    .eq("id", "primary")
    .maybeSingle();
  if (settingsResult.error || !settingsResult.data) {
    return new Response(JSON.stringify({ error: "push_settings_unavailable" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const suppliedToken = request.headers.get("x-growth-os-dispatch-token") || "";
  if (
    !suppliedToken ||
    !secureEqual(suppliedToken, settingsResult.data.dispatch_token)
  ) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  webpush.setVapidDetails(
    settingsResult.data.vapid_subject,
    settingsResult.data.vapid_public_key,
    settingsResult.data.vapid_private_key
  );

  const claimResult = await supabase.rpc(
    "claim_marketing_web_push_deliveries",
    { batch_size: 50 }
  );
  if (claimResult.error) {
    return new Response(
      JSON.stringify({
        error: "delivery_claim_failed",
        code: claimResult.error.code,
      }),
      { status: 500, headers: jsonHeaders }
    );
  }

  const deliveries = (claimResult.data ?? []) as DeliveryRow[];
  if (deliveries.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, sent: 0, retry: 0, gone: 0, failed: 0 }),
      { status: 200, headers: jsonHeaders }
    );
  }

  const notificationIds = [
    ...new Set(deliveries.map((row) => row.notification_id)),
  ];
  const subscriptionIds = [
    ...new Set(deliveries.map((row) => row.subscription_id)),
  ];
  const [notificationsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("marketing_notifications")
      .select(
        "id,notification_type,title,body,task_id,calendar_item_id,creative_job_id,action_url"
      )
      .in("id", notificationIds),
    supabase
      .from("marketing_web_push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .in("id", subscriptionIds)
      .eq("is_active", true),
  ]);
  if (notificationsResult.error || subscriptionsResult.error) {
    return new Response(
      JSON.stringify({ error: "push_dependency_query_failed" }),
      { status: 500, headers: jsonHeaders }
    );
  }

  const notifications = new Map(
    ((notificationsResult.data ?? []) as NotificationRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const subscriptions = new Map(
    ((subscriptionsResult.data ?? []) as SubscriptionRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const taskIds = [
    ...new Set(
      [...notifications.values()]
        .map((row) => row.task_id)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const calendarIds = [
    ...new Set(
      [...notifications.values()]
        .map((row) => row.calendar_item_id)
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const taskStartDates = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("marketing_work_tasks")
      .select("id,start_date")
      .in("id", taskIds);
    for (const row of data ?? []) {
      taskStartDates.set(String(row.id), String(row.start_date ?? ""));
    }
  }
  const calendarDates = new Map<string, string>();
  if (calendarIds.length > 0) {
    const { data } = await supabase
      .from("marketing_calendar_items")
      .select("id,scheduled_date")
      .in("id", calendarIds);
    for (const row of data ?? []) {
      calendarDates.set(String(row.id), String(row.scheduled_date ?? ""));
    }
  }


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

  const counts = { processed: 0, sent: 0, retry: 0, gone: 0, failed: 0 };
  for (const delivery of deliveries) {
    counts.processed += 1;
    const notification = notifications.get(delivery.notification_id);
    const subscription = subscriptions.get(delivery.subscription_id);
    if (!notification || !subscription) {
      await supabase
        .from("marketing_web_push_deliveries")
        .update({
          status: "gone",
          updated_at: new Date().toISOString(),
          last_error: "notification_or_subscription_missing",
        })
        .eq("id", delivery.id);
      counts.gone += 1;
      continue;
    }


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

    let url = notification.action_url || "/tasks";
    if (!notification.action_url && notification.task_id) {
      const startDate = taskStartDates.get(notification.task_id);
      const query = new URLSearchParams({ focus: notification.task_id });
      if (startDate) query.set("week", startDate);
      url = `/tasks?${query.toString()}#task-${notification.task_id}`;
    } else if (!notification.action_url && notification.calendar_item_id) {
      const scheduledDate = calendarDates.get(notification.calendar_item_id);
      url = scheduledDate
        ? `/calendar?month=${scheduledDate.slice(0, 7)}`
        : "/calendar";
    }

    const payload = JSON.stringify({
      title: notification.title,
      body:
        notification.body || "Alyssa Growth OS 有一項新工作更新。",
      tag: `growth-os-${notification.id}`,
      icon: "/icons/growth-os-192.png",
      badge: "/icons/growth-os-192.png",
      url,
      notificationId: notification.id,
      type: notification.notification_type,
      requireInteraction: ["task_overdue", "creative_overdue"].includes(notification.notification_type),
    });

    try {
      const pushResponse = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          TTL: 86400,
          urgency: isUrgent(notification.notification_type)
            ? "high"
            : "normal",
          contentEncoding: "aes128gcm",
          topic: notification.id.replaceAll("-", "").slice(0, 32),
        }
      );
      const sentAt = new Date().toISOString();
      await Promise.all([
        supabase
          .from("marketing_web_push_deliveries")
          .update({
            status: "sent",
            sent_at: sentAt,
            response_status: pushResponse.statusCode || 201,
            last_error: null,
            updated_at: sentAt,
          })
          .eq("id", delivery.id),
        supabase
          .from("marketing_web_push_subscriptions")
          .update({
            failure_count: 0,
            last_success_at: sentAt,
            updated_at: sentAt,
          })
          .eq("id", subscription.id),
      ]);
      counts.sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode || 0)
          : 0;
      const message =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "unknown_push_error";
      const attempted = delivery.attempt_count;
      const gone = statusCode === 404 || statusCode === 410;
      const retryable =
        !gone &&
        attempted < 5 &&
        (statusCode === 0 ||
          statusCode === 408 ||
          statusCode === 429 ||
          statusCode >= 500);
      const nextAttemptAt = new Date(
        Date.now() + retryDelayMinutes(attempted) * 60_000
      ).toISOString();
      await supabase
        .from("marketing_web_push_deliveries")
        .update({
          status: gone ? "gone" : retryable ? "retry" : "failed",
          next_attempt_at: nextAttemptAt,
          response_status: statusCode || null,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
      await supabase
        .from("marketing_web_push_subscriptions")
        .update({
          is_active: gone ? false : true,
          failure_count: attempted,
          last_failure_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
      if (gone) counts.gone += 1;
      else if (retryable) counts.retry += 1;
      else counts.failed += 1;
    }
  }

  return new Response(JSON.stringify(counts), {
    status: 200,
    headers: jsonHeaders,
  });
});
