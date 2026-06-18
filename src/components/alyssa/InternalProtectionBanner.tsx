import {
  hasInternalAccessConfig,
  hasInternalSessionConfig,
  isInternalAuthDisabled,
} from "@/lib/security/internalAccess";

export function InternalProtectionBanner() {
  if (isInternalAuthDisabled()) return null;
  if (hasInternalAccessConfig() && hasInternalSessionConfig()) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-sm font-semibold text-amber-900">
      內部登入保護尚未完整設定，正式使用前請加入 INTERNAL_ACCESS_USERS 及 INTERNAL_AUTH_SESSION_SECRET。
    </div>
  );
}
