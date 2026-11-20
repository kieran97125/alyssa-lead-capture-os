-- Only replace the legacy seed label. Keep edited titles, state and evidence intact.
update public.marketing_system_cards
set title = '平台網址與登入電郵'
where key = 'MKT-DOMAIN'
  and title = 'SmartVolt 平台網址與登入電郵';
