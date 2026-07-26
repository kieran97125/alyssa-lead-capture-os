-- Applied after WhatsApp Broadcast Operations security migration.
-- Covers foreign-key columns identified by the Supabase performance advisor.

create index if not exists whatsapp_contact_consents_contact_idx
  on public.whatsapp_contact_consents (contact_id)
  where contact_id is not null;

create index if not exists whatsapp_suppressions_contact_idx
  on public.whatsapp_suppressions (contact_id)
  where contact_id is not null;

create index if not exists whatsapp_campaigns_connection_idx
  on public.whatsapp_campaigns (connection_id);

create index if not exists whatsapp_campaigns_template_idx
  on public.whatsapp_campaigns (template_id);

create index if not exists whatsapp_campaign_recipients_brand_idx
  on public.whatsapp_campaign_recipients (brand_id);

create index if not exists whatsapp_campaign_recipients_contact_idx
  on public.whatsapp_campaign_recipients (contact_id)
  where contact_id is not null;

create index if not exists whatsapp_campaign_recipients_lead_idx
  on public.whatsapp_campaign_recipients (lead_id)
  where lead_id is not null;

create index if not exists whatsapp_campaign_events_recipient_idx
  on public.whatsapp_campaign_events (recipient_id)
  where recipient_id is not null;
