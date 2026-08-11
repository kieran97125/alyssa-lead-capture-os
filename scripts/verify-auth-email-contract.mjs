import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const templates = [
  ["invite", "invite"],
  ["magic-link", "magiclink"],
];

for (const [fileName, expectedType] of templates) {
  const html = await readFile(
    `${root}supabase/templates/${fileName}.html`,
    "utf8"
  );

  assert.match(html, /https:\/\/app\.beautytrialhk\.com\/auth\/confirm\?/);
  assert.match(html, /token_hash=\{\{ \.TokenHash \}\}/);
  assert.match(html, new RegExp(`type=${expectedType}(?:&|&amp;)`));
  assert.doesNotMatch(html, /localhost/i);
  assert.doesNotMatch(html, /(?:https?:\/\/)?[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(html, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(html, /Alyssa Growth OS/);
  assert.match(html, /role="presentation"/);
}

const authConfig = await readFile(
  `${root}src/lib/supabase/authConfig.ts`,
  "utf8"
);
const inviteActions = await readFile(
  `${root}src/app/command-center/actions.ts`,
  "utf8"
);
assert.match(authConfig, /PRODUCTION_AUTH_LINK_HOST = "app\.beautytrialhk\.com"/);
assert.match(authConfig, /assertSystemDomainAuthLink/);
assert.match(inviteActions, /systemDomainConfirmUrl/);
assert.match(inviteActions, /redirectTo: systemDomainConfirmUrl/);
assert.match(inviteActions, /emailRedirectTo: systemDomainConfirmUrl/);

const syncScript = await readFile(
  `${root}scripts/sync-supabase-auth-email-templates.mjs`,
  "utf8"
);
const syncWorkflow = await readFile(
  `${root}.github/workflows/sync-auth-email-templates.yml`,
  "utf8"
);
assert.match(syncScript, /api\.supabase\.com\/v1\/projects\/\$\{projectRef\}\/config\/auth/);
assert.match(syncScript, /mailer_templates_invite_content/);
assert.match(syncScript, /mailer_templates_magic_link_content/);
assert.match(syncScript, /method: "PATCH"/);
assert.match(syncScript, /Hosted Auth config mismatch/);
assert.match(syncWorkflow, /workflow_dispatch/);
assert.match(syncWorkflow, /secrets\.SUPABASE_ACCESS_TOKEN/);
assert.match(syncWorkflow, /npm run sync:auth-email-templates/);

console.log("Auth email template contract verified.");
