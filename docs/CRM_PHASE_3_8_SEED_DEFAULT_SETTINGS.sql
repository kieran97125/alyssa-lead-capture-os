-- CRM Phase 3.8 Seed Default CRM Settings
-- Review-only seed file. Do not execute until explicitly approved.
--
-- Goal:
-- Seed the current code defaults from `src/lib/crm/settingsConfig.ts` into
-- `public.crm_app_settings` so future DB-backed settings can be tested while
-- preserving code fallback behavior.
--
-- Safety:
-- - Non-destructive: inserts only, `on conflict do nothing`.
-- - Does not overwrite, delete, truncate, disable, or alter existing settings.
-- - Does not alter schema, RLS, policies, public lead submission, Google Sheets,
--   Pixel, thank_you_redirect, consent, form tokens, WhatsApp, Wix embed tracking,
--   Meta behavior, or CRM booking status semantics.
-- - `room_options` preserve the current placeholder default as disabled rows.
-- - `booking_templates` are not seeded yet because the current settings loader
--   does not consume that group.

-- =========================================================
-- 0) Preview before running
-- =========================================================

-- Current settings count:
-- select count(*) as current_settings_count
-- from public.crm_app_settings;

-- Current count by config group:
-- select config_group, count(*) as rows
-- from public.crm_app_settings
-- group by config_group
-- order by config_group;

-- Existing keys that would conflict with this seed:
-- with seed_keys(config_group, config_key) as (
--   values
--     ('contact_channels', 'whatsapp'),
--     ('contact_channels', 'phone'),
--     ('contact_channels', 'inbox'),
--     ('contact_channels', 'other'),
--     ('follow_up_outcomes', 'reached'),
--     ('follow_up_outcomes', 'no_answer'),
--     ('follow_up_outcomes', 'replied'),
--     ('follow_up_outcomes', 'pending'),
--     ('follow_up_outcomes', 'other'),
--     ('lost_reasons', 'no_reply'),
--     ('lost_reasons', 'price_concern'),
--     ('lost_reasons', 'time_not_fit'),
--     ('lost_reasons', 'location_not_fit'),
--     ('lost_reasons', 'changed_mind'),
--     ('lost_reasons', 'duplicate'),
--     ('lost_reasons', 'other'),
--     ('invalid_reasons', 'fake_contact'),
--     ('invalid_reasons', 'wrong_number'),
--     ('invalid_reasons', 'spam'),
--     ('invalid_reasons', 'duplicate'),
--     ('invalid_reasons', 'other'),
--     ('paid_status_labels', 'unknown'),
--     ('paid_status_labels', 'unpaid'),
--     ('paid_status_labels', 'paid'),
--     ('room_options', 'cwb-room-1'),
--     ('room_options', 'cwb-room-2'),
--     ('room_options', 'tst-room-1'),
--     ('inbox_column_presets', 'cs_booking'),
--     ('inbox_column_presets', 'marketing'),
--     ('inbox_column_presets', 'technical'),
--     ('quick_replies', 'first_follow_up'),
--     ('quick_replies', 'confirm_preference'),
--     ('quick_replies', 'booking_confirmation'),
--     ('quick_replies', 'reschedule_time'),
--     ('quick_replies', 'no_response'),
--     ('quick_replies', 'price_concern'),
--     ('quick_replies', 'branch_location'),
--     ('quick_replies', 'booking_reminder'),
--     ('quick_replies', 'no_show_follow_up'),
--     ('quick_replies', 'lost_pause'),
--     ('ai_reply_drafts', 'ai_first_follow_up'),
--     ('ai_reply_drafts', 'ai_booking_confirmation'),
--     ('ai_reply_drafts', 'ai_no_response'),
--     ('ai_reply_drafts', 'ai_objection')
-- )
-- select s.config_group, s.config_key, existing.id, existing.label
-- from seed_keys s
-- join public.crm_app_settings existing
--   on existing.setting_scope = 'global'
--  and existing.config_group = s.config_group
--  and existing.config_key = s.config_key
-- order by s.config_group, s.config_key;

begin;

insert into public.crm_app_settings (
  setting_scope,
  brand_id,
  brand_slug,
  config_group,
  config_key,
  label,
  description,
  value_json,
  enabled,
  locked,
  sort_order,
  created_by,
  updated_by
)
values
  -- Contact channels
  ('global', null, null, 'contact_channels', 'whatsapp', 'WhatsApp', 'Manual WhatsApp contact channel.', jsonb_build_object('value', 'whatsapp'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'contact_channels', 'phone', '電話', 'Manual phone contact channel.', jsonb_build_object('value', 'phone'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'contact_channels', 'inbox', 'Inbox', 'Internal inbox contact channel.', jsonb_build_object('value', 'inbox'), true, false, 30, 'system_seed', 'system_seed'),
  ('global', null, null, 'contact_channels', 'other', '其他', 'Other manual contact channel.', jsonb_build_object('value', 'other'), true, false, 40, 'system_seed', 'system_seed'),

  -- Follow-up outcomes
  ('global', null, null, 'follow_up_outcomes', 'reached', '已接通', 'Customer was reached.', jsonb_build_object('value', 'reached'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'follow_up_outcomes', 'no_answer', '未接 / 未覆', 'No answer or no reply.', jsonb_build_object('value', 'no_answer'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'follow_up_outcomes', 'replied', '已回覆', 'Customer replied.', jsonb_build_object('value', 'replied'), true, false, 30, 'system_seed', 'system_seed'),
  ('global', null, null, 'follow_up_outcomes', 'pending', '待回覆', 'Waiting for customer reply.', jsonb_build_object('value', 'pending'), true, false, 40, 'system_seed', 'system_seed'),
  ('global', null, null, 'follow_up_outcomes', 'other', '其他', 'Other follow-up outcome.', jsonb_build_object('value', 'other'), true, false, 50, 'system_seed', 'system_seed'),

  -- Lost reasons
  ('global', null, null, 'lost_reasons', 'no_reply', '一直未回覆', 'Customer never replied.', jsonb_build_object('value', 'no_reply'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'lost_reasons', 'price_concern', '價錢考慮', 'Customer has price concerns.', jsonb_build_object('value', 'price_concern'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'lost_reasons', 'time_not_fit', '時間不合適', 'Customer time does not fit.', jsonb_build_object('value', 'time_not_fit'), true, false, 30, 'system_seed', 'system_seed'),
  ('global', null, null, 'lost_reasons', 'location_not_fit', '地點不合適', 'Customer location does not fit.', jsonb_build_object('value', 'location_not_fit'), true, false, 40, 'system_seed', 'system_seed'),
  ('global', null, null, 'lost_reasons', 'changed_mind', '改變主意', 'Customer changed mind.', jsonb_build_object('value', 'changed_mind'), true, false, 50, 'system_seed', 'system_seed'),
  ('global', null, null, 'lost_reasons', 'duplicate', '重複登記', 'Duplicate lead.', jsonb_build_object('value', 'duplicate'), true, false, 60, 'system_seed', 'system_seed'),
  ('global', null, null, 'lost_reasons', 'other', '其他', 'Other lost reason.', jsonb_build_object('value', 'other'), true, false, 70, 'system_seed', 'system_seed'),

  -- Invalid reasons
  ('global', null, null, 'invalid_reasons', 'fake_contact', '假資料', 'Fake contact details.', jsonb_build_object('value', 'fake_contact'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'invalid_reasons', 'wrong_number', '電話錯誤', 'Wrong phone number.', jsonb_build_object('value', 'wrong_number'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'invalid_reasons', 'spam', 'Spam', 'Spam lead.', jsonb_build_object('value', 'spam'), true, false, 30, 'system_seed', 'system_seed'),
  ('global', null, null, 'invalid_reasons', 'duplicate', '重複登記', 'Duplicate invalid lead.', jsonb_build_object('value', 'duplicate'), true, false, 40, 'system_seed', 'system_seed'),
  ('global', null, null, 'invalid_reasons', 'other', '其他', 'Other invalid reason.', jsonb_build_object('value', 'other'), true, false, 50, 'system_seed', 'system_seed'),

  -- Paid status labels
  ('global', null, null, 'paid_status_labels', 'unknown', '未確認', 'Paid status is not confirmed.', jsonb_build_object('value', 'unknown'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'paid_status_labels', 'unpaid', '未付款', 'Customer has not paid.', jsonb_build_object('value', 'unpaid'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'paid_status_labels', 'paid', '已付款', 'Customer has paid.', jsonb_build_object('value', 'paid'), true, false, 30, 'system_seed', 'system_seed'),

  -- Room option placeholders. These preserve the current code default disabled state.
  ('global', null, null, 'room_options', 'cwb-room-1', 'CWB Room 1', 'Placeholder room option. Disabled by default.', jsonb_build_object('value', 'cwb-room-1'), false, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'room_options', 'cwb-room-2', 'CWB Room 2', 'Placeholder room option. Disabled by default.', jsonb_build_object('value', 'cwb-room-2'), false, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'room_options', 'tst-room-1', 'TST Room 1', 'Placeholder room option. Disabled by default.', jsonb_build_object('value', 'tst-room-1'), false, false, 30, 'system_seed', 'system_seed'),

  -- Inbox column presets
  ('global', null, null, 'inbox_column_presets', 'cs_booking', 'CS Booking View', 'Booking-first CS operation columns.', jsonb_build_object('description', 'Booking-first CS operation columns.'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'inbox_column_presets', 'marketing', 'Marketing View', 'Source and campaign columns for marketing review.', jsonb_build_object('description', 'Source and campaign columns for marketing review.'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'inbox_column_presets', 'technical', 'Technical Audit View', 'CTWA, URL, and tracking-adjacent audit columns.', jsonb_build_object('description', 'CTWA, URL, and tracking-adjacent audit columns.'), true, false, 30, 'system_seed', 'system_seed'),

  -- Quick reply templates
  ('global', null, null, 'quick_replies', 'first_follow_up', '首次跟進', '新 lead 或未正式聯絡客人時使用。', jsonb_build_object('group', '首次跟進', 'use_case', '新 lead 或未正式聯絡客人時使用。', 'body', '你好，我哋收到你嘅登記，想同你確認預約資料同方便時間。請問你今日方便 WhatsApp 傾一傾預約安排嗎？', 'recommended_statuses', to_jsonb(array['new', 'contacting'])), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'confirm_preference', '確認偏好時間', '客人已填偏好日期時間，但 CS 未確認預約。', jsonb_build_object('group', '首次跟進', 'use_case', '客人已填偏好日期時間，但 CS 未確認預約。', 'body', '收到，你填寫嘅時間我哋會先記錄為偏好時間，稍後由同事確認實際預約安排。', 'recommended_statuses', to_jsonb(array['new', 'contacting'])), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'booking_confirmation', '確認預約安排', 'CS 已確認 booking 後，發給客人核對。', jsonb_build_object('group', '確認預約', 'use_case', 'CS 已確認 booking 後，發給客人核對。', 'body', '已幫你確認預約時間。到時請按時到店，如需要更改時間，可以提前 WhatsApp 我哋。', 'recommended_statuses', to_jsonb(array['booked'])), true, false, 30, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'reschedule_time', '協助更改時間', '客人想改期或原定時間不合適。', jsonb_build_object('group', '更改時間', 'use_case', '客人想改期或原定時間不合適。', 'body', '可以，我哋幫你睇睇其他時間。請回覆你方便嘅日期同大約時段，我哋再同你確認。', 'recommended_statuses', to_jsonb(array['contacting', 'booked'])), true, false, 40, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'no_response', '未回覆跟進', '第一次聯絡後客人未回覆。', jsonb_build_object('group', '未回覆跟進', 'use_case', '第一次聯絡後客人未回覆。', 'body', '你好，想再跟進你早前提交嘅登記。如果仍然想預約，可以直接回覆我哋。', 'recommended_statuses', to_jsonb(array['new', 'contacting'])), true, false, 50, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'price_concern', '價錢疑問回覆', '客人對價錢、優惠或付款安排有疑問。', jsonb_build_object('group', '價錢疑問', 'use_case', '客人對價錢、優惠或付款安排有疑問。', 'body', '明白，價錢方面可以先按今次優惠安排了解清楚。實際療程及付款安排會由同事同你確認，你可以放心先問清楚再決定。', 'recommended_statuses', to_jsonb(array['contacting', 'lost'])), true, false, 60, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'branch_location', '分店位置查詢', '客人查詢分店位置、交通或到店安排。', jsonb_build_object('group', '位置 / 分店查詢', 'use_case', '客人查詢分店位置、交通或到店安排。', 'body', '可以，我哋會按你選擇嘅分店幫你確認地址同預約安排。如你想改其他分店，都可以 WhatsApp 同我哋講。', 'recommended_statuses', to_jsonb(array['new', 'contacting', 'booked'])), true, false, 70, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'booking_reminder', '到店前提醒', '已確認預約，臨近到店前提醒客人。', jsonb_build_object('group', '已預約提醒', 'use_case', '已確認預約，臨近到店前提醒客人。', 'body', '溫馨提示，你嘅預約時間已確認。請按時到店，如臨時需要更改時間，請盡早 WhatsApp 通知我哋。', 'recommended_statuses', to_jsonb(array['booked'])), true, false, 80, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'no_show_follow_up', '未有到店跟進', '客人未按已確認預約時間到店後跟進。', jsonb_build_object('group', 'No-show follow-up', 'use_case', '客人未按已確認預約時間到店後跟進。', 'body', '你好，見到你今日未能按原定時間到店。如你想重新安排時間，可以回覆我哋，我哋再幫你睇可預約時段。', 'recommended_statuses', to_jsonb(array['no_show'])), true, false, 90, 'system_seed', 'system_seed'),
  ('global', null, null, 'quick_replies', 'lost_pause', '暫不處理收尾', '客人表示暫時不考慮或不再跟進。', jsonb_build_object('group', 'Lost / 暫不處理', 'use_case', '客人表示暫時不考慮或不再跟進。', 'body', '明白，謝謝你通知我哋。之後如果想再了解療程或重新預約，可以隨時 WhatsApp 我哋。', 'recommended_statuses', to_jsonb(array['lost'])), true, false, 100, 'system_seed', 'system_seed'),

  -- AI reply draft templates. These use the placeholders supported by settingsLoader.
  ('global', null, null, 'ai_reply_drafts', 'ai_first_follow_up', '首次跟進', 'Template-based AI-style draft. Manual send only.', jsonb_build_object('group', 'AI 回覆草稿', 'use_case', '首次跟進草稿，需人手檢查及發送。', 'body', '你好，我哋係 {{brandName}}，收到你對 {{treatmentOffer}} 嘅登記。想同你確認一下預約資料同時間，方便我哋幫你安排。'), true, false, 10, 'system_seed', 'system_seed'),
  ('global', null, null, 'ai_reply_drafts', 'ai_booking_confirmation', '確認預約', 'Template-based AI-style draft. Manual send only.', jsonb_build_object('group', 'AI 回覆草稿', 'use_case', '確認預約草稿，需人手檢查及發送。', 'body', '你好，已幫你記錄 {{treatmentOffer}}。客人偏好時間：{{appointmentPreference}}。CS 確認預約時間：{{confirmedAppointment}}。如需更改時間，可以直接回覆我哋。'), true, false, 20, 'system_seed', 'system_seed'),
  ('global', null, null, 'ai_reply_drafts', 'ai_no_response', '未回覆跟進', 'Template-based AI-style draft. Manual send only.', jsonb_build_object('group', 'AI 回覆草稿', 'use_case', '未回覆跟進草稿，需人手檢查及發送。', 'body', '你好，想再跟進你早前提交嘅 {{treatmentOffer}} 登記。如果仍然想預約，可以回覆我哋你方便嘅時間。'), true, false, 30, 'system_seed', 'system_seed'),
  ('global', null, null, 'ai_reply_drafts', 'ai_objection', '價錢 / 時間不合適', 'Template-based AI-style draft. Manual send only.', jsonb_build_object('group', 'AI 回覆草稿', 'use_case', '價錢或時間不合適草稿，需人手檢查及發送。', 'body', '明白，謝謝你告知。你可以先考慮一下，如果之後想了解 {{treatmentOffer}} 或其他安排，歡迎再 WhatsApp 我哋。'), true, false, 40, 'system_seed', 'system_seed')
on conflict do nothing;

commit;

-- =========================================================
-- Post-seed verification queries
-- =========================================================

-- Total count:
-- select count(*) as total_settings_count
-- from public.crm_app_settings;

-- Count by config_group:
-- select config_group, count(*) as rows
-- from public.crm_app_settings
-- group by config_group
-- order by config_group;

-- Sample seeded rows:
-- select
--   setting_scope,
--   config_group,
--   config_key,
--   label,
--   enabled,
--   locked,
--   sort_order,
--   created_by,
--   updated_by
-- from public.crm_app_settings
-- where created_by = 'system_seed'
-- order by config_group, sort_order
-- limit 50;

-- Audit count:
-- select count(*) as audit_count
-- from public.crm_app_settings_audit;

-- Audit rows written by seed trigger:
-- select action, actor, metadata_json ->> 'config_group' as config_group, metadata_json ->> 'config_key' as config_key, created_at
-- from public.crm_app_settings_audit
-- where actor = 'system_seed'
-- order by created_at desc
-- limit 50;
