import { NextResponse, type NextRequest } from "next/server";
import {
  createGoogleSheetsOAuthAuthorizationRequest,
  getGoogleSheetsOAuthEnvironmentStatus,
  getMissingGoogleSheetsOAuthConfiguration,
  googleSheetsOAuthStateCookie,
  serializeGoogleSheetsOAuthCookie,
} from "@/lib/integrations/googleSheetsOAuth";
import {
  adminSessionCookieName,
  verifySignedAdminSession,
} from "@/lib/security/internalAccess";

function resultRedirect(request: NextRequest, message: string) {
  const url = new URL("/data-sources", request.url);
  url.searchParams.set("command_status", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, 303);
}

function loginRedirect(request: NextRequest, masterRequired: boolean) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", "/data-sources");
  if (masterRequired) url.searchParams.set("error", "master_required");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const session = await verifySignedAdminSession(
    request.cookies.get(adminSessionCookieName)?.value
  );
  if (!session.ok) return loginRedirect(request, false);
  if (session.accessLevel !== "master") return loginRedirect(request, true);

  const environment = getGoogleSheetsOAuthEnvironmentStatus();
  const missing = getMissingGoogleSheetsOAuthConfiguration(environment);
  if (missing.length > 0) {
    return resultRedirect(
      request,
      `Google OAuth 未可連接；尚欠：${missing
        .map((item) => item.label)
        .join("、")}。`
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
    return resultRedirect(
      request,
      "Google OAuth 啟動失敗；請檢查連接設定後再試。"
    );
  }
}
