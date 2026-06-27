export type CrmConfigOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  enabled?: boolean;
};

export type CrmReplyTemplate = {
  key: string;
  title: string;
  body: string;
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

export const quickReplyTemplates: CrmReplyTemplate[] = [
  {
    key: "first_follow_up",
    title: "首次跟進",
    body: "你好，我哋收到你嘅登記，想同你確認預約資料同方便時間。",
  },
  {
    key: "confirm_preference",
    title: "確認偏好時間",
    body: "收到，你填寫嘅時間我哋會先記錄為偏好時間，稍後由同事確認實際預約安排。",
  },
  {
    key: "no_response",
    title: "未回覆跟進",
    body: "你好，想再跟進你早前提交嘅登記。如果仍然想預約，可以直接回覆我哋。",
  },
  {
    key: "booking_confirmed",
    title: "已確認預約",
    body: "已幫你確認預約時間。到時請按時到店，如需要更改時間，可以提前 WhatsApp 我哋。",
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
