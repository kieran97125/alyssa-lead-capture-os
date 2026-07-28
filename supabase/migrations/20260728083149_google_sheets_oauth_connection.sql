-- Google Sheets OAuth connection for the Alyssa Enterprise command center.
--
-- The refresh token is encrypted by the application before it is stored. This
-- table never stores a Google password, client secret, access token, or Sheet
-- mapping. Browser roles are denied completely; only the server service role
-- may use it.

create table if not exists public.google_sheets_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  connection_key text not null unique,
  status text not null default 'connected',
  scopes text[] not null default '{}',
  refresh_token_encrypted text not null,
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz null,
  last_error_summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_sheets_oauth_connections_key_check
    check (connection_key = 'marketing_dashboard'),
  constraint google_sheets_oauth_connections_status_check
    check (status in ('connected', 'error', 'revoked'))
);

alter table public.google_sheets_oauth_connections enable row level security;

revoke all on table public.google_sheets_oauth_connections from anon, authenticated;
grant select, insert, update, delete on table public.google_sheets_oauth_connections to service_role;

comment on table public.google_sheets_oauth_connections is
  'Server-only encrypted OAuth refresh token for the enterprise Google Sheets read-only connector. Browser roles have no access.';
comment on column public.google_sheets_oauth_connections.refresh_token_encrypted is
  'AES-256-GCM application-encrypted OAuth refresh token. Never expose via a browser client, audit event, configuration JSON or source control.';

update public.marketing_data_sources
set credential_reference = 'google_sheets_oauth:marketing_dashboard',
    updated_at = now()
where provider_key = 'google_sheets'
  and coalesce(credential_reference, '') <> 'google_sheets_oauth:marketing_dashboard';
