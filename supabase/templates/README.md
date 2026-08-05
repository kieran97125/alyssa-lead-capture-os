# Hosted Auth email templates

Canonical Production templates for the hosted Supabase Auth project.

| Supabase template | Subject | File |
| --- | --- | --- |
| Invite user | 你已獲邀加入 Alyssa Growth OS | `invite.html` |
| Magic link | 你的 Alyssa Growth OS 安全登入連結 | `magic-link.html` |

Both templates intentionally build the `/auth/confirm` URL from `TokenHash`
and an explicit OTP type. They do not depend on `ConfirmationURL`, `SiteURL`,
or a caller-provided redirect. This keeps the hosted email path canonical even
if a dashboard URL setting is accidentally changed.

The hosted dashboard remains the delivery source of truth. When either file is
changed, update its matching Auth email template in Supabase and send a real
test message before release.
