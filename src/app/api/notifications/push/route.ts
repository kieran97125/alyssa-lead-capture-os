import { NextResponse } from "next/server";
import { verifyCurrentInternalAccess } from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
  deviceLabel?: unknown;
};

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function textValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function currentMember() {
  const verified = await verifyCurrentInternalAccess();
  if (
    !verified.ok ||
    verified.access.source !== "supabase_auth" ||
    !verified.access.memberId
  ) {
    return null;
  }
  return {
    id: verified.access.memberId,
    email: verified.access.email || null,
  };
}

export async function GET() {
  const member = await currentMember();
  if (!member) {
    return response(
      {
        ready: false,
        message:
          "桌面通知只支援已登入嘅個人受邀帳戶；共用管理員登入唔會綁定私人裝置。",
      },
      403
    );
  }
  if (!hasSupabaseAdminEnv()) {
    return response({ ready: false, message: "桌面通知資料服務未連接。" }, 503);
  }

  const supabase = createSupabaseAdminClient();
  const [settingsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("marketing_web_push_settings")
      .select("vapid_public_key")
      .eq("id", "primary")
      .maybeSingle(),
    supabase
      .from("marketing_web_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("is_active", true),
  ]);

  if (settingsResult.error || !settingsResult.data?.vapid_public_key) {
    return response({ ready: false, message: "桌面通知尚未完成系統設定。" }, 503);
  }
  if (subscriptionsResult.error) {
    return response({ ready: false, message: "未能讀取桌面通知狀態。" }, 500);
  }

  return response({
    ready: true,
    publicKey: settingsResult.data.vapid_public_key,
    activeSubscriptions: subscriptionsResult.count ?? 0,
  });
}

export async function POST(request: Request) {
  const member = await currentMember();
  if (!member) {
    return response({ message: "請使用個人受邀帳戶登入後再開啟桌面通知。" }, 403);
  }
  if (!hasSupabaseAdminEnv()) {
    return response({ message: "桌面通知資料服務未連接。" }, 503);
  }

  let body: SubscriptionBody;
  try {
    body = (await request.json()) as SubscriptionBody;
  } catch {
    return response({ message: "桌面通知資料格式不正確。" }, 400);
  }

  const endpoint = textValue(body.endpoint, 4096);
  const p256dh = textValue(body.keys?.p256dh, 512);
  const auth = textValue(body.keys?.auth, 256);
  const deviceLabel = textValue(body.deviceLabel, 120) || null;
  if (
    !endpoint.startsWith("https://") ||
    !base64UrlPattern.test(p256dh) ||
    p256dh.length < 20 ||
    !base64UrlPattern.test(auth) ||
    auth.length < 8
  ) {
    return response({ message: "瀏覽器提供嘅 Push Subscription 無效。" }, 400);
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const subscriptionResult = await supabase
    .from("marketing_web_push_subscriptions")
    .upsert(
      {
        member_id: member.id,
        endpoint,
        p256dh,
        auth,
        content_encoding: "aes128gcm",
        user_agent: textValue(request.headers.get("user-agent"), 500) || null,
        device_label: deviceLabel,
        is_active: true,
        failure_count: 0,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "endpoint" }
    )
    .select("id")
    .single();

  if (subscriptionResult.error || !subscriptionResult.data) {
    console.warn("marketing_web_push_subscription_upsert_failed", {
      code: subscriptionResult.error?.code,
    });
    return response({ message: "未能儲存呢部裝置嘅桌面通知設定。" }, 500);
  }

  const recentNotifications = await supabase
    .from("marketing_notifications")
    .select("id")
    .eq("recipient_member_id", member.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(10);
  if (!recentNotifications.error && (recentNotifications.data?.length ?? 0) > 0) {
    await supabase.from("marketing_web_push_deliveries").upsert(
      (recentNotifications.data ?? []).map((notification) => ({
        notification_id: notification.id,
        subscription_id: subscriptionResult.data.id,
        status: "pending",
        next_attempt_at: now,
        updated_at: now,
      })),
      {
        onConflict: "notification_id,subscription_id",
        ignoreDuplicates: true,
      }
    );
    await supabase.rpc("request_marketing_web_push_dispatch");
  }

  return response({ enabled: true });
}

export async function DELETE(request: Request) {
  const member = await currentMember();
  if (!member) return response({ message: "未能識別目前帳戶。" }, 403);
  if (!hasSupabaseAdminEnv()) {
    return response({ message: "桌面通知資料服務未連接。" }, 503);
  }

  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    endpoint = textValue(body.endpoint, 4096);
  } catch {
    return response({ message: "桌面通知資料格式不正確。" }, 400);
  }
  if (!endpoint.startsWith("https://")) {
    return response({ message: "缺少有效裝置資料。" }, 400);
  }

  const now = new Date().toISOString();
  const { error } = await createSupabaseAdminClient()
    .from("marketing_web_push_subscriptions")
    .update({ is_active: false, updated_at: now })
    .eq("member_id", member.id)
    .eq("endpoint", endpoint);
  if (error) {
    return response({ message: "未能關閉呢部裝置嘅桌面通知。" }, 500);
  }
  return response({ enabled: false });
}
