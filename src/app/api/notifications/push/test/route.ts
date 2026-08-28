import { NextResponse } from "next/server";
import { getConfiguredBrands } from "@/lib/data/configuration";
import {
  canAccessInternalBrand,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST() {
  const verified = await verifyCurrentInternalAccess();
  if (
    !verified.ok ||
    verified.access.source !== "supabase_auth" ||
    !verified.access.memberId
  ) {
    return response(
      { message: "請使用個人受邀帳戶登入後再測試桌面通知。" },
      403
    );
  }
  if (!hasSupabaseAdminEnv()) {
    return response({ message: "桌面通知資料服務未連接。" }, 503);
  }

  const supabase = createSupabaseAdminClient();
  const subscriptionsResult = await supabase
    .from("marketing_web_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("member_id", verified.access.memberId)
    .eq("is_active", true);
  if (subscriptionsResult.error || (subscriptionsResult.count ?? 0) === 0) {
    return response({ message: "請先開啟呢部裝置嘅桌面通知。" }, 409);
  }

  const brands = (await getConfiguredBrands()).filter((brand) =>
    canAccessInternalBrand(verified.access, brand.id)
  );
  const brand = brands[0];
  if (!brand) {
    return response({ message: "目前帳戶未有可用品牌，未能建立測試通知。" }, 403);
  }

  const { error } = await supabase.from("marketing_notifications").insert({
    recipient_member_id: verified.access.memberId,
    recipient_email: verified.access.email || null,
    brand_id: brand.id,
    notification_type: "desktop_test",
    title: "桌面通知測試成功",
    body: "Alyssa Growth OS Web Push 已經連接呢部裝置。",
    dedupe_key: `desktop_test:${verified.access.memberId}:${crypto.randomUUID()}`,
  });
  if (error) {
    console.warn("marketing_web_push_test_notification_failed", {
      code: error.code,
    });
    return response({ message: "未能建立測試通知。" }, 500);
  }

  return response({ queued: true }, 202);
}
