import { NextResponse, type NextRequest } from "next/server";
import {
  createGoogleSheetsOAuthAuthorizationRequest,
  getMissingGoogleSheetsOAuthConfiguration,
  getGoogleSheetsOAuthStatus,
  googleSheetsOAuthStateCookie,
  serializeGoogleSheetsOAuthCookie,
} from "@/lib/integrations/googleSheetsOAuth";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

function resultRedirect(message: string) {
  const params = new URLSearchParams({
    command_status: "error",
    message,
  });
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/data-sources?${params.toString()}` },
  });
}

function loginRedirect(masterRequired: boolean) {
  const params = new URLSearchParams({ next: "/data-sources" });
  if (masterRequired) params.set("error", "master_required");
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/login?${params.toString()}` },
  });
}

export async function POST(request: NextRequest) {
  const session = await verifySignedAdminSession(
    request.cookies.get(adminSessionCookieName)?.value
  );
  if (!session.ok) return loginRedirect(false);
  if (session.accessLevel !== "master") return loginRedirect(true);

  const connectionStatus = await getGoogleSheetsOAuthStatus();
  const missing = getMissingGoogleSheetsOAuthConfiguration(connectionStatus);
  if (missing.length > 0) {
    return resultRedirect(
      `Google OAuth 未可連接；尚欠：${missing
        .map((item) => item.label)
        .join("、")}。`
    );
  }

  if (!connectionStatus.tableReady) {
    return resultRedirect(
      "Google OAuth 憑證儲存尚未準備；請先完成資料庫連接及 migration。"
    );
  }

  try {
    const oauthRequest = await createGoogleSheetsOAuthAuthorizationRequest();
    const response = NextResponse.redirect(oauthRequest.authorizationUrl, 303);
    response.cookies.set(
      googleSheetsOAuthStateCookie.name,
      serializeGoogleSheetsOAuthCookie({
        state: oauthRequest.state,
        codeVerifier: oauthRequest.codeVerifier,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: googleSheetsOAuthStateCookie.maxAge,
      }
    );
    return response;
  } catch (error) {
    console.warn("google_sheets_oauth_start_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return resultRedirect("Google OAuth 啟動失敗；請檢查連接設定後再試。");
  }
}
