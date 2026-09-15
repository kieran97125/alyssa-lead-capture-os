import assert from 'node:assert/strict';
let state = { password_hibp_enabled: false, site_url: 'https://preserve.example', jwt_exp: 3600, smtp_pass: 'SYNTHETIC_PRIVATE_DO_NOT_LOG' };
let patched = false;
// All requests are intercepted: tests must never call a real Auth project.
globalThis.fetch = async (url, options = {}) => {
  assert.equal(url, 'https://api.supabase.com/v1/projects/syntheticproject/config/auth');
  if (process.env.AUTH_MOCK_FAIL === 'http') return { ok: false, status: 403, statusText: 'Forbidden' };
  if (options.method === 'PATCH') {
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['mailer_subjects_invite', 'mailer_subjects_magic_link', 'mailer_templates_invite_content', 'mailer_templates_magic_link_content', 'password_hibp_enabled'].sort());
    assert.equal(body.password_hibp_enabled, true);
    state = { ...state, ...body }; patched = true;
  }
  if (patched && process.env.AUTH_MOCK_FAIL === 'readback') state.password_hibp_enabled = false;
  assert.equal(state.site_url, 'https://preserve.example');
  assert.equal(state.jwt_exp, 3600);
  return { ok: true, json: async () => ({ ...state }) };
};
