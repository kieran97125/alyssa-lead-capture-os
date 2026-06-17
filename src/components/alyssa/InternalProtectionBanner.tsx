import { hasInternalAccessConfig } from "@/lib/security/internalAccess";

export function InternalProtectionBanner() {
  if (hasInternalAccessConfig()) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-sm font-semibold text-amber-900">
      內部頁面保護尚未設定，正式使用前請加入環境變數。
    </div>
  );
}
