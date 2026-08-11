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

## Hosted synchronization

Run `npm run sync:auth-email-templates` to update only the hosted Invite and
Magic Link subjects and bodies through the Supabase Management API. The command
performs a preflight GET, a scoped PATCH, then a second GET and exact-value
verification. It never prints the access token or the full hosted configuration.

Required environment:

- `SUPABASE_ACCESS_TOKEN`: an account-level Supabase Personal Access Token.
- `NEXT_PUBLIC_SUPABASE_URL`: used to derive the hosted project reference.
- `SUPABASE_PROJECT_REF`: optional explicit project reference.

GitHub Actions exposes the same operation as the manual
`Sync Supabase Auth Email Templates` workflow. Store the account token only as
the repository Actions secret `SUPABASE_ACCESS_TOKEN`; never commit it or paste
it into an issue, PR, log or chat.

A real authorized recipient flow remains the final release evidence after every
hosted template change.
