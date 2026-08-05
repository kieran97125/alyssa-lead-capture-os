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
  assert.doesNotMatch(html, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(html, /Alyssa Growth OS/);
  assert.match(html, /role="presentation"/);
}

console.log("Auth email template contract verified.");
