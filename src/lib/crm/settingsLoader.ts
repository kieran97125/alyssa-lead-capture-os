import "server-only";
import { createSupabaseAdminClient, getSupabaseAdminEnvStatus } from "@/lib/supabase/admin";
import {
  contactChannelOptions,
  crmInboxPresets,
  followUpOutcomeOptions,
  getCrmAiReplyDrafts,
  invalidReasonOptions,
  lostReasonOptions,
  paidStatusOptions,
  quickReplyTemplates,
  roomOptionPlaceholders,
  type CrmInboxPreset,
  type CrmInboxPresetConfig,
  type CrmConfigOption,
  type CrmReplyTemplate,
} from "@/lib/crm/settingsConfig";

type SettingsSource = "code_defaults" | "db_defaults" | "db_override" | "db_unavailable_code_defaults";

type DbSettingRow = {
  setting_scope: string | null;
  brand_slug: string | null;
  config_group: string;
  config_key: string;
  label: string;
  description: string | null;
  value_json: Record<string, unknown> | null;
  enabled: boolean;
  sort_order: number;
};

export type CrmSettingsLoaderStatus = {
  activeSource: SettingsSource;
  label: string;
  dbAttempted: boolean;
  dbAvailable: boolean;
  dbRowsLoaded: number;
  warning: string | null;
};

export type ResolvedCrmSettings = {
  status: CrmSettingsLoaderStatus;
  contactChannelOptions: CrmConfigOption[];
  followUpOutcomeOptions: CrmConfigOption[];
  lostReasonOptions: CrmConfigOption[];
  invalidReasonOptions: CrmConfigOption[];
  paidStatusOptions: CrmConfigOption[];
  roomOptionPlaceholders: CrmConfigOption[];
  quickReplyTemplates: CrmReplyTemplate[];
  aiReplyDraftTemplates: CrmReplyTemplate[];
  inboxColumnPresets: CrmInboxPresetConfig[];
};

const settingsGroups = [
  "contact_channels",
  "follow_up_outcomes",
  "lost_reasons",
  "invalid_reasons",
  "paid_status_labels",
  "room_options",
  "quick_replies",
  "ai_reply_drafts",
  "inbox_column_presets",
];

export async function getCrmSettings(options: { brandSlug?: string | null } = {}) {
  const codeDefaults = getCodeDefaultSettings();
  const envStatus = getSupabaseAdminEnvStatus();

  if (!envStatus.ready) {
    return withStatus(codeDefaults, {
      activeSource: "db_unavailable_code_defaults",
      label: "DB unavailable, using code defaults",
      dbAttempted: false,
      dbAvailable: false,
      dbRowsLoaded: 0,
      warning: envStatus.reason ?? "Supabase admin client is not configured.",
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const brandSlug = options.brandSlug?.trim().toLowerCase() || "";
    const { data, error } = await supabase
      .from("crm_app_settings")
      .select("setting_scope, brand_slug, config_group, config_key, label, description, value_json, enabled, sort_order")
      .in("config_group", settingsGroups)
      .or(`setting_scope.eq.global,brand_slug.eq.${brandSlug || "__no_brand__"}`)
      .order("config_group", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return withStatus(codeDefaults, {
        activeSource: "db_unavailable_code_defaults",
        label: "DB unavailable, using code defaults",
        dbAttempted: true,
        dbAvailable: false,
        dbRowsLoaded: 0,
        warning: normalizeDbWarning(error.message),
      });
    }

    const rows = (Array.isArray(data) ? data : []) as DbSettingRow[];
    const resolved = applyDbSettings(codeDefaults, rows, brandSlug);
    const source = resolveSettingsSource(rows, resolved !== codeDefaults, brandSlug);

    return withStatus(resolved, {
      activeSource: source,
      label: settingsSourceLabel(source),
      dbAttempted: true,
      dbAvailable: true,
      dbRowsLoaded: rows.length,
      warning: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown settings loader error.";
    return withStatus(codeDefaults, {
      activeSource: "db_unavailable_code_defaults",
      label: "DB unavailable, using code defaults",
      dbAttempted: true,
      dbAvailable: false,
      dbRowsLoaded: 0,
      warning: normalizeDbWarning(message),
    });
  }
}

function getCodeDefaultSettings(): Omit<ResolvedCrmSettings, "status"> {
  return {
    contactChannelOptions: [...contactChannelOptions],
    followUpOutcomeOptions: [...followUpOutcomeOptions],
    lostReasonOptions: [...lostReasonOptions],
    invalidReasonOptions: [...invalidReasonOptions],
    paidStatusOptions: [...paidStatusOptions],
    roomOptionPlaceholders: [...roomOptionPlaceholders],
    quickReplyTemplates: [...quickReplyTemplates],
    aiReplyDraftTemplates: [],
    inboxColumnPresets: [...crmInboxPresets],
  };
}

function withStatus(
  settings: Omit<ResolvedCrmSettings, "status">,
  status: CrmSettingsLoaderStatus
): ResolvedCrmSettings {
  return {
    ...settings,
    status,
  };
}

function applyDbSettings(
  defaults: Omit<ResolvedCrmSettings, "status">,
  rows: DbSettingRow[],
  brandSlug: string
) {
  const grouped = groupResolvedRows(rows, brandSlug);
  let changed = false;

  const next = {
    ...defaults,
  };

  const contactChannels = rowsToOptions(grouped.get("contact_channels"));
  if (contactChannels.length > 0) {
    next.contactChannelOptions = contactChannels;
    changed = true;
  }

  const followUpOutcomes = rowsToOptions(grouped.get("follow_up_outcomes"));
  if (followUpOutcomes.length > 0) {
    next.followUpOutcomeOptions = followUpOutcomes;
    changed = true;
  }

  const lostReasons = rowsToOptions(grouped.get("lost_reasons"));
  if (lostReasons.length > 0) {
    next.lostReasonOptions = lostReasons;
    changed = true;
  }

  const invalidReasons = rowsToOptions(grouped.get("invalid_reasons"));
  if (invalidReasons.length > 0) {
    next.invalidReasonOptions = invalidReasons;
    changed = true;
  }

  const paidStatuses = rowsToOptions(grouped.get("paid_status_labels"));
  if (paidStatuses.length > 0) {
    next.paidStatusOptions = paidStatuses;
    changed = true;
  }

  const roomOptions = rowsToOptions(grouped.get("room_options"));
  if (roomOptions.length > 0) {
    next.roomOptionPlaceholders = roomOptions;
    changed = true;
  }

  const quickReplies = rowsToQuickReplies(grouped.get("quick_replies"));
  if (quickReplies.length > 0) {
    next.quickReplyTemplates = quickReplies;
    changed = true;
  }

  const aiReplyDrafts = rowsToQuickReplies(grouped.get("ai_reply_drafts"));
  if (aiReplyDrafts.length > 0) {
    next.aiReplyDraftTemplates = aiReplyDrafts;
    changed = true;
  }

  const inboxPresets = rowsToInboxPresets(grouped.get("inbox_column_presets"));
  if (inboxPresets.length > 0) {
    next.inboxColumnPresets = inboxPresets;
    changed = true;
  }

  return changed ? next : defaults;
}

function resolveSettingsSource(
  rows: DbSettingRow[],
  hasResolvedDbSettings: boolean,
  brandSlug: string
): SettingsSource {
  if (!hasResolvedDbSettings) return "code_defaults";
  const hasBrandOverride = rows.some((row) => row.enabled && rowScopeRank(row, brandSlug) === 1);
  return hasBrandOverride ? "db_override" : "db_defaults";
}

function settingsSourceLabel(source: SettingsSource) {
  if (source === "db_override") return "DB override + code fallback";
  if (source === "db_defaults") return "DB default settings + code fallback";
  if (source === "db_unavailable_code_defaults") return "DB unavailable, using code defaults";
  return "Code defaults";
}

function groupResolvedRows(rows: DbSettingRow[], brandSlug: string) {
  const byGroupKey = new Map<string, DbSettingRow>();
  const sorted = [...rows].sort((a, b) => {
    const aRank = rowScopeRank(a, brandSlug);
    const bRank = rowScopeRank(b, brandSlug);
    return aRank - bRank || a.sort_order - b.sort_order;
  });

  for (const row of sorted) {
    if (!row.enabled || !row.config_group || !row.config_key) continue;
    const rank = rowScopeRank(row, brandSlug);
    if (rank < 0) continue;
    byGroupKey.set(`${row.config_group}:${row.config_key}`, row);
  }

  const grouped = new Map<string, DbSettingRow[]>();
  for (const row of byGroupKey.values()) {
    const current = grouped.get(row.config_group) ?? [];
    current.push(row);
    grouped.set(row.config_group, current);
  }

  for (const [group, groupRows] of grouped.entries()) {
    grouped.set(
      group,
      groupRows.sort((a, b) => a.sort_order - b.sort_order || a.config_key.localeCompare(b.config_key))
    );
  }

  return grouped;
}

function rowScopeRank(row: DbSettingRow, brandSlug: string) {
  if (row.setting_scope === "global") return 0;
  if (
    row.setting_scope === "brand" &&
    brandSlug &&
    row.brand_slug?.trim().toLowerCase() === brandSlug
  ) {
    return 1;
  }
  return -1;
}

function rowsToOptions(rows: DbSettingRow[] = []): CrmConfigOption[] {
  const options: CrmConfigOption[] = [];

  for (const row of rows) {
    const value = stringValue(row.value_json?.value) || row.config_key;
    if (!value || !row.label) continue;
    options.push({
      value,
      label: row.label,
      enabled: row.enabled,
    });
  }

  return options;
}

function rowsToQuickReplies(rows: DbSettingRow[] = []): CrmReplyTemplate[] {
  const replies: CrmReplyTemplate[] = [];

  for (const row of rows) {
    const body = stringValue(row.value_json?.body);
    if (!body || !row.label) continue;
    replies.push({
      key: row.config_key,
      group: stringValue(row.value_json?.group) || "Quick replies",
      title: row.label,
      useCase: stringValue(row.value_json?.use_case) || row.description || "Manual CS reply draft.",
      body,
      recommendedStatuses: stringArray(row.value_json?.recommended_statuses),
    });
  }

  return replies;
}

function rowsToInboxPresets(rows: DbSettingRow[] = []): CrmInboxPresetConfig[] {
  const allowedKeys: CrmInboxPreset[] = ["cs_booking", "marketing", "technical"];
  const presets: CrmInboxPresetConfig[] = [];

  for (const row of rows) {
    const key = row.config_key as CrmInboxPreset;
    if (!allowedKeys.includes(key) || !row.label) continue;
    presets.push({
      key,
      label: row.label,
      description:
        stringValue(row.value_json?.description) ||
        row.description ||
        crmInboxPresets.find((preset) => preset.key === key)?.description ||
        "",
      enabled: row.enabled,
    });
  }

  return presets;
}

export function getCrmAiReplyDraftsFromSettings(
  settings: ResolvedCrmSettings,
  input: {
    brandName: string;
    treatmentOffer: string;
    appointmentPreference: string;
    confirmedAppointment: string;
  }
) {
  if (settings.aiReplyDraftTemplates.length === 0) {
    return getCrmAiReplyDrafts(input);
  }

  return settings.aiReplyDraftTemplates.map((template) => ({
    key: template.key,
    title: template.title,
    body: applyTemplateVariables(template.body, input),
  }));
}

function applyTemplateVariables(
  body: string,
  input: {
    brandName: string;
    treatmentOffer: string;
    appointmentPreference: string;
    confirmedAppointment: string;
  }
) {
  return body
    .replaceAll("{{brandName}}", input.brandName)
    .replaceAll("{{treatmentOffer}}", input.treatmentOffer)
    .replaceAll("{{appointmentPreference}}", input.appointmentPreference)
    .replaceAll("{{confirmedAppointment}}", input.confirmedAppointment);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
}

function normalizeDbWarning(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("crm_app_settings") ||
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("permission denied")
  ) {
    return "CRM DB settings are unavailable; using code defaults.";
  }
  return "CRM settings loader could not read DB settings; using code defaults.";
}
