export type CrmConfigOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  enabled?: boolean;
};

export type CrmReplyTemplate = {
  key: string;
  group: string;
  title: string;
  useCase: string;
  body: string;
  recommendedStatuses?: readonly string[];
};

export type CrmInboxPreset = "cs_booking" | "marketing" | "technical";

export type CrmInboxPresetConfig = {
  key: CrmInboxPreset;
  label: string;
  description: string;
  enabled?: boolean;
};

export const crmStatusOptions = [
  { value: "new", label: "待跟進" },
  { value: "contacting", label: "已聯絡" },
  { value: "booked", label: "已預約" },
  { value: "showed", label: "已到店" },
  { value: "no_show", label: "No-show" },
  { value: "lost", label: "已流失" },
  { value: "invalid", label: "無效" },
] as const satisfies readonly CrmConfigOption[];

export const contactChannelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "電話" },
  { value: "inbox", label: "Inbox" },
  { value: "other", label: "其他" },
] as const satisfies readonly CrmConfigOption[];

export const followUpOutcomeOptions = [
  { value: "reached", label: "已接通" },
  { value: "no_answer", label: "未接 / 未覆" },
  { value: "replied", label: "已回覆" },
  { value: "pending", label: "待回覆" },
  { value: "other", label: "其他" },
] as const satisfies readonly CrmConfigOption[];

export const lostReasonOptions = [
  { value: "no_reply", label: "一直未回覆" },
  { value: "price_concern", label: "價錢考慮" },
  { value: "time_not_fit", label: "時間不合適" },
  { value: "location_not_fit", label: "地點不合適" },
  { value: "changed_mind", label: "改變主意" },
  { value: "duplicate", label: "重複登記" },
  { value: "other", label: "其他" },
] as const satisfies readonly CrmConfigOption[];

export const invalidReasonOptions = [
  { value: "fake_contact", label: "假資料" },
  { value: "wrong_number", label: "電話錯誤" },
  { value: "spam", label: "Spam" },
  { value: "duplicate", label: "重複登記" },
  { value: "other", label: "其他" },
] as const satisfies readonly CrmConfigOption[];

export const paidStatusOptions = [
  { value: "unknown", label: "未確認" },
  { value: "unpaid", label: "未付款" },
  { value: "paid", label: "已付款" },
] as const satisfies readonly CrmConfigOption[];

export const roomOptionPlaceholders = [
  { value: "cwb-room-1", label: "CWB Room 1", enabled: false },
  { value: "cwb-room-2", label: "CWB Room 2", enabled: false },
  { value: "tst-room-1", label: "TST Room 1", enabled: false },
] as const satisfies readonly CrmConfigOption[];

export const crmInboxPresets: CrmInboxPresetConfig[] = [
  {
    key: "cs_booking",
    label: "CS Booking View",
    description: "Booking-first CS operation columns.",
  },
  {
    key: "marketing",
    label: "Marketing View",
    description: "Source and campaign columns for marketing review.",
  },
  {
    key: "technical",
    label: "Technical Audit View",
    description: "CTWA, URL, and tracking-adjacent audit columns.",
  },
];

export const quickReplyTemplates: CrmReplyTemplate[] = [
  {
    key: "first_follow_up",
    group: "首次跟進",
    title: "首次跟進",
    useCase: "新 lead 或未正式聯絡客人時使用。",
    body: "你好，我哋收到你嘅登記，想同你確認預約資料同方便時間。請問你今日方便 WhatsApp 傾一傾預約安排嗎？",
    recommendedStatuses: ["new", "contacting"],
  },
  {
    key: "confirm_preference",
    group: "首次跟進",
    title: "確認偏好時間",
    useCase: "客人已填偏好日期時間，但 CS 未確認預約。",
    body: "收到，你填寫嘅時間我哋會先記錄為偏好時間，稍後由同事確認實際預約安排。",
    recommendedStatuses: ["new", "contacting"],
  },
  {
    key: "booking_confirmation",
    group: "確認預約",
    title: "確認預約安排",
    useCase: "CS 已確認 booking 後，發給客人核對。",
    body: "已幫你確認預約時間。到時請按時到店，如需要更改時間，可以提前 WhatsApp 我哋。",
    recommendedStatuses: ["booked"],
  },
  {
    key: "reschedule_time",
    group: "更改時間",
    title: "協助更改時間",
    useCase: "客人想改期或原定時間不合適。",
    body: "可以，我哋幫你睇睇其他時間。請回覆你方便嘅日期同大約時段，我哋再同你確認。",
    recommendedStatuses: ["contacting", "booked"],
  },
  {
    key: "no_response",
    group: "未回覆跟進",
    title: "未回覆跟進",
    body: "你好，想再跟進你早前提交嘅登記。如果仍然想預約，可以直接回覆我哋。",
    useCase: "第一次聯絡後客人未回覆。",
    recommendedStatuses: ["new", "contacting"],
  },
  {
    key: "price_concern",
    group: "價錢疑問",
    title: "價錢疑問回覆",
    useCase: "客人對價錢、優惠或付款安排有疑問。",
    body: "明白，價錢方面可以先按今次優惠安排了解清楚。實際療程及付款安排會由同事同你確認，你可以放心先問清楚再決定。",
    recommendedStatuses: ["contacting", "lost"],
  },
  {
    key: "branch_location",
    group: "位置 / 分店查詢",
    title: "分店位置查詢",
    useCase: "客人查詢分店位置、交通或到店安排。",
    body: "可以，我哋會按你選擇嘅分店幫你確認地址同預約安排。如你想改其他分店，都可以 WhatsApp 同我哋講。",
    recommendedStatuses: ["new", "contacting", "booked"],
  },
  {
    key: "booking_reminder",
    group: "已預約提醒",
    title: "到店前提醒",
    useCase: "已確認預約，臨近到店前提醒客人。",
    body: "溫馨提示，你嘅預約時間已確認。請按時到店，如臨時需要更改時間，請盡早 WhatsApp 通知我哋。",
    recommendedStatuses: ["booked"],
  },
  {
    key: "no_show_follow_up",
    group: "No-show follow-up",
    title: "未有到店跟進",
    useCase: "客人未按已確認預約時間到店後跟進。",
    body: "你好，見到你今日未能按原定時間到店。如你想重新安排時間，可以回覆我哋，我哋再幫你睇可預約時段。",
    recommendedStatuses: ["no_show"],
  },
  {
    key: "lost_pause",
    group: "Lost / 暫不處理",
    title: "暫不處理收尾",
    useCase: "客人表示暫時不考慮或不再跟進。",
    body: "明白，謝謝你通知我哋。之後如果想再了解療程或重新預約，可以隨時 WhatsApp 我哋。",
    recommendedStatuses: ["lost"],
  },
];

export function getCrmAiReplyDrafts(input: {
  brandName: string;
  treatmentOffer: string;
  appointmentPreference: string;
  confirmedAppointment: string;
}) {
  const brand = input.brandName || "我們";
  const treatment = input.treatmentOffer || "療程";
  const preference = input.appointmentPreference || "你填寫的時間";
  const confirmed = input.confirmedAppointment || "稍後由同事確認";

  return [
    {
      key: "ai_first_follow_up",
      title: "首次跟進",
      body: `你好，我哋係 ${brand}，收到你對 ${treatment} 嘅登記。想同你確認一下預約資料同時間，方便我哋幫你安排。`,
    },
    {
      key: "ai_booking_confirmation",
      title: "確認預約",
      body: `你好，已幫你記錄 ${treatment}。客人偏好時間：${preference}。CS 確認預約時間：${confirmed}。如需更改時間，可以直接回覆我哋。`,
    },
    {
      key: "ai_no_response",
      title: "未回覆跟進",
      body: `你好，想再跟進你早前提交嘅 ${treatment} 登記。如果仍然想預約，可以回覆我哋你方便嘅時間。`,
    },
    {
      key: "ai_objection",
      title: "價錢 / 時間不合適",
      body: `明白，謝謝你告知。你可以先考慮一下，如果之後想了解 ${treatment} 或其他安排，歡迎再 WhatsApp 我哋。`,
    },
  ];
}

export function optionTuples(options: readonly CrmConfigOption[]) {
  return options.map((item) => [item.value, item.label] as [string, string]);
}

export function optionValues<T extends readonly CrmConfigOption[]>(options: T) {
  return options.map((item) => item.value);
}

export function optionLabel(
  options: readonly CrmConfigOption[],
  value: string,
  fallback = value
) {
  return options.find((item) => item.value === value)?.label ?? fallback;
}
