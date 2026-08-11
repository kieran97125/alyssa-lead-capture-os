import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveProjectRef() {
  const configured = process.env.SUPABASE_PROJECT_REF?.trim();
  if (configured) return configured;

  const projectUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const hostname = new URL(projectUrl).hostname;
  const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  if (!match) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a hosted Supabase project URL.");
  }
  return match[1];
}

function validateRecipientFacingTemplate(name, html, expectedType) {
  assert.match(
    html,
    /https:\/\/app\.beautytrialhk\.com\/auth\/confirm\?/,
    `${name} must open on the canonical Growth OS domain.`
  );
  assert.match(html, /token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(html, new RegExp(`type=${expectedType}(?:&|&amp;)`));
  assert.doesNotMatch(html, /\{\{ \.ConfirmationURL \}\}/);
  assert.doesNotMatch(html, /(?:https?:\/\/)?[a-z0-9-]+\.supabase\.co/i);
}

async function readTemplate(fileName) {
  return readFile(`${root}supabase/templates/${fileName}`, "utf8");
}

async function requestConfig(endpoint, accessToken, init = {}) {
  const response = await fetch(endpoint, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(
      `Supabase Management API request failed (${response.status} ${response.statusText}).`
    );
  }
  return response.json();
}

const accessToken = required("SUPABASE_ACCESS_TOKEN");
const projectRef = resolveProjectRef();
if (!/^[a-z0-9]+$/i.test(projectRef)) {
  throw new Error("SUPABASE_PROJECT_REF has an invalid format.");
}

const [inviteHtml, magicLinkHtml] = await Promise.all([
  readTemplate("invite.html"),
  readTemplate("magic-link.html"),
]);
validateRecipientFacingTemplate("Invite", inviteHtml, "invite");
validateRecipientFacingTemplate("Magic Link", magicLinkHtml, "magiclink");

const expected = {
  mailer_subjects_invite: "你已獲邀加入 Alyssa Growth OS",
  mailer_templates_invite_content: inviteHtml,
  mailer_subjects_magic_link: "你的 Alyssa Growth OS 安全登入連結",
  mailer_templates_magic_link_content: magicLinkHtml,
};
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

await requestConfig(endpoint, accessToken);
await requestConfig(endpoint, accessToken, {
  method: "PATCH",
  body: JSON.stringify(expected),
});
const verified = await requestConfig(endpoint, accessToken);

for (const [key, value] of Object.entries(expected)) {
  assert.equal(verified[key], value, `Hosted Auth config mismatch: ${key}`);
}

const digest = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);

console.log(
  JSON.stringify({
    ok: true,
    synced: ["invite", "magic_link"],
    inviteSha256: digest(inviteHtml),
    magicLinkSha256: digest(magicLinkHtml),
  })
);
