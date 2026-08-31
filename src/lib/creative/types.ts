export const creativeJobStatuses = [
  "draft",
  "assigned",
  "waiting_assets",
  "in_progress",
  "review",
  "revision",
  "approved",
  "delivered",
  "completed",
  "blocked",
  "cancelled",
] as const;

export type CreativeJobStatus = (typeof creativeJobStatuses)[number];

export const creativeJobStatusLabels: Record<CreativeJobStatus, string> = {
  draft: "草稿",
  assigned: "已派發",
  waiting_assets: "等素材",
  in_progress: "製作中",
  review: "待 Review",
  revision: "需要修改",
  approved: "已批准",
  delivered: "Final 已交付",
  completed: "已完成",
  blocked: "有阻礙",
  cancelled: "已取消",
};

export const creativePriorities = ["normal", "priority", "urgent"] as const;
export type CreativePriority = (typeof creativePriorities)[number];
export const creativePriorityLabels: Record<CreativePriority, string> = {
  normal: "一般",
  priority: "優先",
  urgent: "緊急",
};

export const creativeWorkloads = ["S", "M", "L", "XL"] as const;
export type CreativeWorkload = (typeof creativeWorkloads)[number];

export const creativeTaxonomyCategories = [
  "source",
  "usage",
  "media_format",
] as const;
export type CreativeTaxonomyCategory =
  (typeof creativeTaxonomyCategories)[number];

export const creativeTaxonomyCategoryLabels: Record<
  CreativeTaxonomyCategory,
  string
> = {
  source: "素材來源",
  usage: "用途",
  media_format: "媒體格式",
};

export const creativeAssetPurposes = [
  "source",
  "reference",
  "draft",
  "final",
  "brief",
] as const;
export type CreativeAssetPurpose = (typeof creativeAssetPurposes)[number];
export const creativeAssetPurposeLabels: Record<CreativeAssetPurpose, string> = {
  source: "原始素材",
  reference: "參考素材",
  draft: "Draft",
  final: "Final",
  brief: "Brief 圖片",
};

export type CreativeTaxonomyItem = {
  id: string;
  category: CreativeTaxonomyCategory;
  name: string;
  isActive: boolean;
  sortOrder: number;
  usageCount?: number;
};

export type CreativeDesignerProfile = {
  id: string;
  displayName: string;
  linkedMemberId: string | null;
  linkedMemberName: string | null;
  linkedMemberEmail: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type CreativeJobRow = {
  id: string;
  brandId: string;
  brandName: string;
  treatmentId: string | null;
  treatmentLabel: string | null;
  title: string;
  status: CreativeJobStatus;
  priority: CreativePriority;
  workload: CreativeWorkload;
  startDate: string;
  startTime: string | null;
  dueDate: string | null;
  dueTime: string | null;
  publishDate: string | null;
  publishTime: string | null;
  syncCalendar: boolean;
  calendarItemId: string | null;
  sourceTaxonomyId: string | null;
  sourceName: string | null;
  usageTaxonomyId: string | null;
  usageName: string | null;
  mediaFormatTaxonomyId: string | null;
  mediaFormatName: string | null;
  assigneeProfileId: string | null;
  assigneeProfileName: string | null;
  assigneeMemberId: string | null;
  assigneeEmail: string | null;
  requesterMemberId: string | null;
  requesterEmail: string | null;
  materialStatus: "ready" | "waiting";
  quantity: number;
  specifications: string | null;
  sourceUrl: string | null;
  referenceUrl: string | null;
  briefDocument: Record<string, unknown>;
  briefPlainText: string;
  revisionCount: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreativeAsset = {
  id: string;
  jobId: string;
  assetKind: "upload" | "link";
  purpose: CreativeAssetPurpose;
  label: string;
  externalUrl: string | null;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdByEmail: string | null;
  createdAt: string;
  url: string;
};

export type CreativeComment = {
  id: string;
  authorMemberId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: string;
};

export type CreativeBriefVersion = {
  id: string;
  versionNo: number;
  reason: "autosave" | "manual" | "status_change" | "restore";
  createdByEmail: string | null;
  createdAt: string;
};

export type CreativeNotification = {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  actionUrl: string | null;
};

export type CreativeListFilters = {
  scope?: "mine" | "all";
  brandId?: string;
  status?: string;
  priority?: string;
  designerId?: string;
  view?: string;
};
