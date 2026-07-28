import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  completeGoogleSheetsOAuthAuthorization,
  googleSheetsOAuthStateCookie,
  hasMatchingGoogleSheetsOAuthState,
  parseGoogleSheetsOAuthCookie,
} from "@/lib/integrations/googleSheetsOAuth";
import { MASTER_ACCOUNT_EMAIL } from "@/lib/marketing/commandCenter";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

function resultRedirect(request: NextRequest, ok: boolean, message: string) {
  const url = new URL("/data-sources", request.url);
  url.searchParams.set("command_status", ok ? "success" : "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(googleSheetsOAuthStateCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const googleError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const storedState = parseGoogleSheetsOAuthCookie(
    request.cookies.get(googleSheetsOAuthStateCookie.name)?.value
  );
  const session = await verifySignedAdminSession(
    request.cookies.get(adminSessionCookieName)?.value
  );

  if (!session.ok || session.accessLevel !== "master") {
    return clearStateCookie(
      resultRedirect(request, false, "Google 授權只限 Master Account 完成。")
    );
  }
  if (
    !state ||
    !storedState ||
    !hasMatchingGoogleSheetsOAuthState(storedState.state, state)
  ) {
    return clearStateCookie(
      resultRedirect(request, false, "Google 授權驗證已過期或無效，請重新開始。")
    );
  }
  if (googleError) {
    return clearStateCookie(
      resultRedirect(
        request,
        false,
        googleError === "access_denied"
          ? "你取消咗 Google 授權，未有作出任何更改。"
          : "Google 授權未能完成，請再試一次。"
      )
    );
  }
  if (!code) {
    return clearStateCookie(
      resultRedirect(request, false, "Google 未有返回有效授權碼，請重新開始。")
    );
  }

  const result = await completeGoogleSheetsOAuthAuthorization({
    code,
    codeVerifier: storedState.codeVerifier,
  });
  if (result.ok) {
    try {
      await createSupabaseAdminClient()
        .from("marketing_command_center_audit")
        .insert({
          actor_email: MASTER_ACCOUNT_EMAIL,
          action: "google_sheets_oauth.connected",
          entity_type: "google_sheets_oauth_connection",
          entity_id: "marketing_dashboard",
          after_json: { scope: "spreadsheets.readonly" },
        });
    } catch (error) {
      console.warn("google_sheets_oauth_audit_write_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
    revalidatePath("/dashboard");
    revalidatePath("/data-sources");
  }

  return clearStateCookie(resultRedirect(request, result.ok, result.message));
}
