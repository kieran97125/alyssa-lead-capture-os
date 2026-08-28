create index if not exists marketing_web_push_deliveries_subscription_idx
  on public.marketing_web_push_deliveries(subscription_id, created_at desc);
