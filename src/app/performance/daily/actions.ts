"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditDailySpendAccess } from "@/lib/marketing/dailyOverview";
import {
  EDITABLE_SPEND_TYPES,
  SPEND_TYPE_LABELS,
  type EditableSpendType,
} from "@/lib/marketing/spendTypes";
import {
  canAccessInternalBrand,
  requireModuleAccess,
  verifyCurrentInternalAccess,
} from "@/lib/security/internalAccessServer";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeReturnPath(value: string) {
  return value.startsWith("/performance/daily") ? value : "/performance/daily";
}

function redirectResult(path: string, ok: boolean, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}command_status=${ok ? "success" : "error"}&message=${encodeURIComponent(message)}`
  );
}

function nullableAmount(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function saveDailyBrandSpendAction(formData: FormData) {
  const returnPath = safeReturnPath(readString(formData, "returnPath"));
  const verified = await verifyCurrentInternalAccess();
  if (!verified.ok) redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  const moduleAccess = await requireModuleAccess("performance");
  if (!moduleAccess.allowed) {
    redirectResult(returnPath, false, "你未獲授權修改每日廣告費。");
  }
  if (!hasSupabaseAdminEnv()) {
    redirectResult(returnPath, false, "資料服務尚未連接，暫時未能儲存廣告費。" );
  }
  if (
    !canEditDailySpendAccess({
      accessLevel: verified.access.accessLevel,
      workspaceRole: verified.access.workspaceRole,
    })
  ) {
    redirectResult(
      returnPath,
      false,
      "只有 Master、Admin、Manager 或 Marketer 可以修改廣告費。"
    );
  }

  const spendDate = readString(formData, "spendDate");
  const brandId = readString(formData, "brandId");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spendDate) || !brandId) {
    redirectResult(returnPath, false, "請檢查廣告費日期及品牌。" );
  }
  if (!canAccessInternalBrand(verified.access, brandId)) {
    redirectResult(returnPath, false, "你未獲授權修改呢個品牌嘅廣告費。" );
  }

  const changes = EDITABLE_SPEND_TYPES.flatMap((spendType) => {
    const amount = nullableAmount(readString(formData, `amount:${spendType}`));
    const originalAmount = nullableAmount(
      readString(formData, `originalAmount:${spendType}`)
    );
    const note = readString(formData, `note:${spendType}`) || null;
    const originalNote = readString(formData, `originalNote:${spendType}`) || null;
    const expectedRevisionRaw = readString(
      formData,
      `expectedRevision:${spendType}`
    );
    const expectedRevision = expectedRevisionRaw
      ? Number(expectedRevisionRaw)
      : null;
    if (amount === originalAmount && note === originalNote) return [];
    return [
      {
        spendType,
        amount,
        note,
        expectedRevision,
      },
    ];
  });

  if (changes.length === 0) {
    redirectResult(returnPath, true, `${spendDate} 廣告費未有變更，帳簿保持不變。`);
  }
  const invalid = changes.find(
    (entry) =>
      (entry.amount !== null &&
        (!Number.isFinite(entry.amount) || entry.amount < 0 || entry.amount > 99_999_999.99)) ||
      (entry.note?.length ?? 0) > 500 ||
      (entry.expectedRevision !== null &&
        (!Number.isInteger(entry.expectedRevision) || entry.expectedRevision < 1))
  );
  if (invalid) {
    redirectResult(returnPath, false, "請檢查各 Source 廣告費數字及備註。" );
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: preflightError } = await supabase
    .from("marketing_daily_spend_entries")
    .select("spend_type,revision")
    .eq("brand_id", brandId)
    .eq("spend_date", spendDate)
    .in(
      "spend_type",
      changes.map((entry) => entry.spendType)
    );
  if (preflightError) {
    redirectResult(returnPath, false, "未能核對最新廣告費版本，請重新載入再試。" );
  }
  const revisionByType = new Map(
    (existing ?? []).map((row) => [String(row.spend_type), Number(row.revision)])
  );
  const stale = changes.find((entry) => {
    const currentRevision = revisionByType.get(entry.spendType) ?? null;
    return currentRevision !== entry.expectedRevision;
  });
  if (stale) {
    redirectResult(
      returnPath,
      false,
      `${SPEND_TYPE_LABELS[stale.spendType]} 已被其他人更新，請重新載入頁面再儲存。`
    );
  }

  const actorIdentifier =
    verified.access.email ||
    (verified.access.accessLevel === "master" ? "master" : "shared_admin");
  let savedCount = 0;
  let deletedCount = 0;
  const savedLabels: string[] = [];

  for (const entry of changes) {
    const { data, error } = await supabase.rpc("save_marketing_daily_spend", {
      p_spend_date: spendDate,
      p_spend_type: entry.spendType,
      p_entries: [
        {
          brandId,
          amount: entry.amount,
          note: entry.note,
          expectedRevision: entry.expectedRevision,
        },
      ],
      p_actor_email: actorIdentifier,
    });
    if (error) {
      console.warn("daily_brand_spend_save_failed", {
        spendType: entry.spendType,
        code: error.code,
        message: error.message,
      });
      const message = error.message.includes("future_spend_date_not_allowed")
        ? "未來日期未能填寫廣告費。"
        : error.message.includes("stale_spend_entry")
          ? "其中一個 Source 已被其他人更新；已儲存嘅 Source 會保留，請重新載入後再補餘下項目。"
          : "部分 Source 未能儲存；已成功寫入嘅項目會保留，請重新載入核對。";
      revalidatePath("/performance/daily");
      revalidatePath("/performance/compare");
      revalidatePath("/dashboard");
      redirectResult(returnPath, false, message);
    }
    const result =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    savedCount += Number(result.savedCount ?? 0);
    deletedCount += Number(result.deletedCount ?? 0);
    savedLabels.push(SPEND_TYPE_LABELS[entry.spendType]);
  }

  revalidatePath("/performance/daily");
  revalidatePath("/performance/compare");
  revalidatePath("/dashboard");
  revalidatePath("/kpis");
  redirectResult(
    returnPath,
    true,
    `${spendDate} 已更新 ${savedLabels.join("、")}：儲存 ${savedCount} 項${deletedCount > 0 ? `，清除 ${deletedCount} 項舊值` : ""}。`
  );
}
