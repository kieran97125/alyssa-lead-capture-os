import { NextResponse } from "next/server";
import {
  createGoogleSheetsOAuthAuthorizationRequest,
  getMissingGoogleSheetsOAuthConfiguration,
  getGoogleSheetsOAuthStatus,
  googleSheetsOAuthStateCookie,
  serializeGoogleSheetsOAuthCookie,
} from "@/lib/integrations/googleSheetsOAuth";
import { verifyCurrentInternalAccess } from "@/lib/security/internalAccessServer";

function resultRedirect(message: string, purpose = "sheets") {
  const params = new URLSearchParams({
    command_status: "error",
    message,
  });
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `${purpose === "reports" ? "/reports" : "/data-sources"}?${params.toString()}` },
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

export async function POST(request: Request) {
  const purpose = new URL(request.url).searchParams.get("purpose") === "reports" ? "reports" : "sheets";
  const session = await verifyCurrentInternalAccess();
  if (!session.ok) return loginRedirect(false);
  if (session.access.accessLevel !== "master") return loginRedirect(true);

  const connectionStatus = await getGoogleSheetsOAuthStatus();
  const missing = getMissingGoogleSheetsOAuthConfiguration(connectionStatus);
  if (missing.length > 0) {
    return resultRedirect(
      `Google OAuth 未可連接；尚欠：${missing
        .map((item) => item.label)
        .join("、")}。`, purpose
    );
  }

  if (!connectionStatus.tableReady) {
    return resultRedirect(
      "Google OAuth 憑證儲存尚未準備；請先完成資料庫連接及 migration。", purpose
    );
  }

  try {
    const oauthRequest = await createGoogleSheetsOAuthAuthorizationRequest(purpose);
    const response = NextResponse.redirect(oauthRequest.authorizationUrl, 303);
    response.cookies.set(
      googleSheetsOAuthStateCookie.name,
      serializeGoogleSheetsOAuthCookie({
        state: oauthRequest.state,
        codeVerifier: oauthRequest.codeVerifier,
        purpose,
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
    return resultRedirect("Google OAuth 啟動失敗；請檢查連接設定後再試。", purpose);
  }
}
