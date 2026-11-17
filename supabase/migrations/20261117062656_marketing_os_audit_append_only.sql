-- Supabase default privileges can include TRUNCATE/REFERENCES/TRIGGER for
-- service_role. The application audit client receives only read and append.
revoke all on public.marketing_platform_audit from public, anon, authenticated, service_role;
grant select, insert on public.marketing_platform_audit to service_role;
