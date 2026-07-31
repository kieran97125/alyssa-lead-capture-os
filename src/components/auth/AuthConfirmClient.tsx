"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase/authBrowser";

const supportedOtpTypes = new Set<EmailOtpType>([
  "email",
  "invite",
  "magiclink",
]);

export function AuthConfirmClient({
  code,
  next,
  tokenHash,
  type,
}: {
  code: string;
  next: string;
  tokenHash: string;
  type: string;
}) {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function confirm() {
      try {
        const supabase = createSupabaseBrowserAuthClient();
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`
          );
        } else if (tokenHash && supportedOtpTypes.has(type as EmailOtpType)) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });
          if (otpError) throw otpError;
        } else if (code) {
          const { error: codeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;
        } else {
          const { data } = await supabase.auth.getUser();
          if (!data.user) throw new Error("missing_auth_confirmation");
        }

        const response = await fetch("/api/auth/finalize", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ next }),
        });
        const result = (await response.json()) as {
          ok?: boolean;
          redirectTo?: string;
        };
        if (!response.ok || !result.ok || !result.redirectTo) {
          throw new Error("workspace_invitation_not_active");
        }
        window.location.replace(result.redirectTo);
      } catch {
        if (!cancelled) {
          setError(
            "邀請連結已過期、已使用，或者呢個電郵未獲授權。請聯絡 Master 喺「成員及權限」頁重發安全連結。"
          );
        }
      }
    }

    void confirm();
    return () => {
      cancelled = true;
    };
  }, [code, next, tokenHash, type]);

  return (
    <div className="text-center">
      {error ? (
        <>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
            <TriangleAlert size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[#321428]">
            未能完成登入
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#6d4a5c]">
            {error}
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex rounded-full bg-[#5a2348] px-6 py-3 text-sm font-bold text-white"
          >
            返回登入說明
          </a>
        </>
      ) : (
        <>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f8e8e2] text-[#5a2348]">
            <LoaderCircle
              size={24}
              className="animate-spin motion-reduce:animate-none"
            />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[#321428]">
            正在驗證公司身份
          </h1>
          <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#6d4a5c]">
            <CheckCircle2 size={15} />
            核對邀請、角色同品牌權限後會自動進入工作區
          </p>
        </>
      )}
    </div>
  );
}
