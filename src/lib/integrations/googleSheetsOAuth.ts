import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";

export const GOOGLE_SHEETS_WRITE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";
const OAUTH_CONNECTION_KEY = "marketing_dashboard";
const OAUTH_STATE_COOKIE_NAME = "growth_os_google_sheets_oauth";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const ENCRYPTION_PREFIX = "gsoauth:v1";
const STATE_COOKIE_PREFIX = "gsoauthstate:v1";
const PRODUCTION_OAUTH_REDIRECT_URI =
  "https://app.beautytrialhk.com/api/integrations/google-sheets/callback";

type OAuthConnectionRow = {
  id: string;
  connection_key: string;
  status: "connected" | "error" | "revoked";
  scopes: string[] | null;
  refresh_token_encrypted: string;
  connected_at: string | null;
  last_verified_at: string | null;
  last_error_summary: string | null;
  updated_at: string;
};

export type GoogleSheetsOAuthEnvironmentStatus = {
  ready: boolean;
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  redirectUriPresent: boolean;
  encryptionKeyPresent: boolean;
  redirectUri: string | null;
};

export type GoogleSheetsOAuthConfigurationItem = {
  key:
    | "client_id"
    | "client_secret"
    | "redirect_uri"
    | "token_encryption_key";
  label: string;
};

export type GoogleSheetsOAuthStatus = GoogleSheetsOAuthEnvironmentStatus & {
  tableReady: boolean;
  connected: boolean;
  writeEnabled: boolean;
  connectionStatus: OAuthConnectionRow["status"] | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
  lastErrorSummary: string | null;
};

export type GoogleSheetsOAuthCookiePayload = {
  state: string;
  codeVerifier: string;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function validRedirectUri(value: string) {
  try {
    const parsed = new URL(value);
    const callbackPath = "/api/integrations/google-sheets/callback";
    const localDevelopment =
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" && !localDevelopment) ||
      parsed.pathname !== callbackPath ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function configuredRedirectUri() {
  // Keep the production OAuth contract independent from public/embed base URLs.
  // Production must not be overridden by a stale or tenant-specific environment
  // value because Google requires an exact redirect URI match.
  if (env("VERCEL_ENV") === "production") {
    return PRODUCTION_OAUTH_REDIRECT_URI;
  }

  // Previews and local development can opt into their own registered callback.
  const explicit = validRedirectUri(env("GOOGLE_SHEETS_OAUTH_REDIRECT_URI"));
  if (explicit) return explicit;

  for (const name of ["NEXT_PUBLIC_ADMIN_BASE_URL", "NEXT_PUBLIC_APP_URL"]) {
    const baseUrl = env(name);
    if (!baseUrl) continue;
    try {
      const candidate = new URL(
        "/api/integrations/google-sheets/callback",
        baseUrl
      ).toString();
      const valid = validRedirectUri(candidate);
      if (valid) return valid;
    } catch {
      // Continue to the next trusted application base URL.
    }
  }

  return null;
}

export function getGoogleSheetsOAuthEnvironmentStatus(): GoogleSheetsOAuthEnvironmentStatus {
  const clientId = env("GOOGLE_SHEETS_OAUTH_CLIENT_ID");
  const clientSecret = env("GOOGLE_SHEETS_OAUTH_CLIENT_SECRET");
  const tokenEncryptionKey = env("GOOGLE_SHEETS_OAUTH_TOKEN_ENCRYPTION_KEY");
  const redirectUri = configuredRedirectUri();

  return {
    ready: Boolean(clientId && clientSecret && tokenEncryptionKey && redirectUri),
    clientIdPresent: Boolean(clientId),
    clientSecretPresent: Boolean(clientSecret),
    redirectUriPresent: Boolean(redirectUri),
    encryptionKeyPresent: Boolean(tokenEncryptionKey),
    redirectUri,
  };
}

export function getMissingGoogleSheetsOAuthConfiguration(
  status = getGoogleSheetsOAuthEnvironmentStatus()
): GoogleSheetsOAuthConfigurationItem[] {
  return [
    !status.clientIdPresent
      ? { key: "client_id" as const, label: "Google OAuth Client ID" }
      : null,
    !status.clientSecretPresent
      ? { key: "client_secret" as const, label: "Google OAuth Client Secret" }
      : null,
    !status.redirectUriPresent
      ? {
          key: "redirect_uri" as const,
          label: "OAuth Callback URL（未設定或格式不正確）",
        }
      : null,
    !status.encryptionKeyPresent
      ? {
          key: "token_encryption_key" as const,
          label: "OAuth Token Encryption Key",
        }
      : null,
  ].filter(
    (item): item is GoogleSheetsOAuthConfigurationItem => item !== null
  );
}

function getOAuthClient() {
  const environment = getGoogleSheetsOAuthEnvironmentStatus();
  if (!environment.ready || !environment.redirectUri) {
    throw new Error(
      "Google Sheets OAuth 尚未完成部署設定；請先加入 Client ID、Client Secret、Callback URL 及 Token Encryption Key。"
    );
  }

  return new OAuth2Client(
    env("GOOGLE_SHEETS_OAUTH_CLIENT_ID"),
    env("GOOGLE_SHEETS_OAUTH_CLIENT_SECRET"),
    environment.redirectUri
  );
}

function getEncryptionKey() {
  const rawKey = env("GOOGLE_SHEETS_OAUTH_TOKEN_ENCRYPTION_KEY");
  return rawKey ? createHash("sha256").update(rawKey).digest() : null;
}

function encryptRefreshToken(value: string) {
  const key = getEncryptionKey();
  if (!key) throw new Error("google_sheets_oauth_encryption_key_missing");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function decryptRefreshToken(value: string | null | undefined) {
  if (!value) return null;
  const key = getEncryptionKey();
  if (!key) return null;

  const [prefix, version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (`${prefix}:${version}` !== ENCRYPTION_PREFIX) return null;
  if (!ivValue || !tagValue || !encryptedValue) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function isMissingOAuthTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "42P01" ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("google_sheets_oauth_connections"))
  );
}

async function getConnectionRow() {
  if (!hasSupabaseAdminEnv()) {
    return { row: null, tableReady: false };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("google_sheets_oauth_connections")
    .select(
      "id,connection_key,status,scopes,refresh_token_encrypted,connected_at,last_verified_at,last_error_summary,updated_at"
    )
    .eq("connection_key", OAUTH_CONNECTION_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingOAuthTable(error)) return { row: null, tableReady: false };
    throw error;
  }

  return {
    row: (data as OAuthConnectionRow | null) ?? null,
    tableReady: true,
  };
}

export async function getGoogleSheetsOAuthStatus(): Promise<GoogleSheetsOAuthStatus> {
  const environment = getGoogleSheetsOAuthEnvironmentStatus();

  try {
    const { row, tableReady } = await getConnectionRow();
    const connected = Boolean(environment.ready && row?.status === "connected");
    return {
      ...environment,
      tableReady,
      connected,
      writeEnabled: Boolean(
        connected && row?.scopes?.includes(GOOGLE_SHEETS_WRITE_SCOPE)
      ),
      connectionStatus: row?.status ?? null,
      connectedAt: row?.connected_at ?? null,
      lastVerifiedAt: row?.last_verified_at ?? null,
      lastErrorSummary: row?.last_error_summary ?? null,
    };
  } catch (error) {
    console.warn("google_sheets_oauth_status_read_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ...environment,
      tableReady: false,
      connected: false,
      writeEnabled: false,
      connectionStatus: null,
      connectedAt: null,
      lastVerifiedAt: null,
      lastErrorSummary: "未能讀取 OAuth 連接狀態。",
    };
  }
}

export async function createGoogleSheetsOAuthAuthorizationRequest() {
  const client = getOAuthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const state = randomBytes(32).toString("base64url");
  const authorizationUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_SHEETS_WRITE_SCOPE],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });

  return { authorizationUrl, state, codeVerifier };
}

export function serializeGoogleSheetsOAuthCookie(
  value: GoogleSheetsOAuthCookiePayload
) {
  const key = getEncryptionKey();
  if (!key) throw new Error("google_sheets_oauth_encryption_key_missing");

  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url"
  );
  const signature = createHmac("sha256", key)
    .update(`${STATE_COOKIE_PREFIX}:${payload}`)
    .digest("base64url");

  return `${STATE_COOKIE_PREFIX}:${payload}:${signature}`;
}

export function parseGoogleSheetsOAuthCookie(value: string | undefined | null) {
  if (!value) return null;
  try {
    const [prefix, version, payload, receivedSignature] = value.split(":");
    if (
      `${prefix}:${version}` !== STATE_COOKIE_PREFIX ||
      !payload ||
      !receivedSignature
    ) {
      return null;
    }
    const key = getEncryptionKey();
    if (!key) return null;
    const expectedSignature = createHmac("sha256", key)
      .update(`${STATE_COOKIE_PREFIX}:${payload}`)
      .digest();
    const actualSignature = Buffer.from(receivedSignature, "base64url");
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<GoogleSheetsOAuthCookiePayload>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      parsed.state.length < 32 ||
      parsed.codeVerifier.length < 32
    ) {
      return null;
    }
    return { state: parsed.state, codeVerifier: parsed.codeVerifier };
  } catch {
    return null;
  }
}

export function hasMatchingGoogleSheetsOAuthState(
  expected: string,
  received: string
) {
  const expectedValue = Buffer.from(expected, "utf8");
  const receivedValue = Buffer.from(received, "utf8");
  return (
    expectedValue.length === receivedValue.length &&
    timingSafeEqual(expectedValue, receivedValue)
  );
}

function safeGoogleError(error: unknown) {
  if (!(error instanceof Error)) return "Google 授權或認證失敗。";
  if (/invalid_grant|invalid_client|unauthorized_client/i.test(error.message)) {
    return "Google 授權已失效，請重新連接公司 Google 帳戶。";
  }
  return "Google 授權暫時失敗，請稍後再試。";
}

export async function completeGoogleSheetsOAuthAuthorization(input: {
  code: string;
  codeVerifier: string;
}) {
  const client = getOAuthClient();

  try {
    const { tokens } = await client.getToken({
      code: input.code,
      codeVerifier: input.codeVerifier,
    });
    const refreshToken = tokens.refresh_token?.trim();
    if (!refreshToken) {
      throw new Error("google_sheets_oauth_refresh_token_missing");
    }

    client.setCredentials({ refresh_token: refreshToken });
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) {
      throw new Error("google_sheets_oauth_access_token_missing");
    }

    const timestamp = new Date().toISOString();
    const returnedScopes = (tokens.scope || GOOGLE_SHEETS_WRITE_SCOPE)
      .split(" ")
      .filter(Boolean);
    if (!returnedScopes.includes(GOOGLE_SHEETS_WRITE_SCOPE)) {
      throw new Error("google_sheets_oauth_required_scope_missing");
    }
    const scopes = [GOOGLE_SHEETS_WRITE_SCOPE];
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("google_sheets_oauth_connections")
      .upsert(
        {
          connection_key: OAUTH_CONNECTION_KEY,
          status: "connected",
          scopes,
          refresh_token_encrypted: encryptRefreshToken(refreshToken),
          connected_at: timestamp,
          last_verified_at: timestamp,
          last_error_summary: null,
          updated_at: timestamp,
        },
        { onConflict: "connection_key" }
      );
    if (error) throw error;

    return { ok: true as const, message: "Google Sheets 已成功連接。" };
  } catch (error) {
    console.warn("google_sheets_oauth_callback_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false as const, message: safeGoogleError(error) };
  }
}

export async function getGoogleSheetsOAuthAccessToken(
  options: { requireWrite?: boolean } = {}
) {
  const { row, tableReady } = await getConnectionRow();
  if (!tableReady) {
    throw new Error("Google Sheets OAuth migration 尚未套用。");
  }
  if (!row || row.status !== "connected") {
    throw new Error("Google Sheets 尚未連接；請由 Master 先完成一次 Google 授權。");
  }
  if (
    options.requireWrite &&
    !row.scopes?.includes(GOOGLE_SHEETS_WRITE_SCOPE)
  ) {
    throw new Error(
      "Google Sheets 目前只具唯讀權限；請由 Master 重新連接一次以啟用 Lead 寫入。"
    );
  }

  const refreshToken = decryptRefreshToken(row.refresh_token_encrypted);
  if (!refreshToken) {
    await markGoogleSheetsOAuthConnectionError(
      "Google 授權憑證無法讀取，請重新連接。"
    );
    throw new Error("Google Sheets 授權憑證無法讀取，請由 Master 重新連接。");
  }

  try {
    const client = getOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("google_sheets_oauth_access_token_missing");

    const timestamp = new Date().toISOString();
    await createSupabaseAdminClient()
      .from("google_sheets_oauth_connections")
      .update({
        status: "connected",
        last_verified_at: timestamp,
        last_error_summary: null,
        updated_at: timestamp,
      })
      .eq("id", row.id);
    return token.token;
  } catch (error) {
    const message = safeGoogleError(error);
    await markGoogleSheetsOAuthConnectionError(message);
    throw new Error(message);
  }
}

export async function markGoogleSheetsOAuthConnectionError(message: string) {
  if (!hasSupabaseAdminEnv()) return;
  try {
    await createSupabaseAdminClient()
      .from("google_sheets_oauth_connections")
      .update({
        status: "error",
        last_error_summary: message.slice(0, 240),
        updated_at: new Date().toISOString(),
      })
      .eq("connection_key", OAUTH_CONNECTION_KEY);
  } catch (error) {
    console.warn("google_sheets_oauth_error_status_write_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export const googleSheetsOAuthStateCookie = {
  name: OAUTH_STATE_COOKIE_NAME,
  maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
};
