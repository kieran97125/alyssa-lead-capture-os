import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function run(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [
    '--import', resolve('e2e/fixtures/auth-config-fetch-mock.mjs'),
    resolve('scripts/sync-supabase-auth-email-templates.mjs'),
  ], {
    env: { ...process.env, AUTH_MOCK_FAIL: '', SUPABASE_ACCESS_TOKEN: 'SYNTHETIC_ACCESS_TOKEN', SUPABASE_PROJECT_REF: 'syntheticproject', ...env },
    encoding: 'utf8', timeout: 15000,
  });
}
test('managed Auth config: enable protection with a scoped PATCH', () => {
  const result = run(); assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout); assert.equal(report.ok, true); assert.equal(report.leakedPasswordProtection, true);
});
test('managed Auth config: never print secret values', () => {
  const result = run(); assert.ok(!result.stdout.includes('SYNTHETIC')); assert.ok(!result.stderr.includes('SYNTHETIC'));
});
test('managed Auth config: provider denial fails without success output', () => {
  const result = run({ AUTH_MOCK_FAIL: 'http' }); assert.notEqual(result.status, 0); assert.match(result.stderr, /403/); assert.equal(result.stdout, '');
});
test('managed Auth config: mismatched readback fails verification', () => {
  const result = run({ AUTH_MOCK_FAIL: 'readback' }); assert.notEqual(result.status, 0); assert.match(result.stderr, /password_hibp_enabled/); assert.equal(result.stdout, '');
});
test('managed Auth config: missing token fails before any request', () => {
  const result = run({ SUPABASE_ACCESS_TOKEN: '' }); assert.notEqual(result.status, 0); assert.match(result.stderr, /Missing required/);
});
