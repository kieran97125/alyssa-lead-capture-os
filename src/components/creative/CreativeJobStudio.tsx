"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  History,
  ImagePlus,
  Link2,
  MessageSquareText,
  Paperclip,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  CreativeBriefEditor,
  type CreativeBriefEditorHandle,
} from "@/components/creative/CreativeBriefEditor";
import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";
import { CreativeBriefHistoryDialog } from "@/components/creative/CreativeBriefHistoryDialog";
import {
  addCreativeCommentAction,
  addCreativeLinkAssetAction,
  markCreativeNotificationReadAction,
  removeCreativeAssetAction,
  updateCreativeJobAction,
  updateCreativeJobStatusAction,
} from "@/app/creative-jobs/actions";
import { restoreCreativeBriefVersionAction } from "@/app/creative-jobs/versionActions";
import {
  creativeAssetPurposeLabels,
  creativeAssetPurposes,
  creativeJobStatusLabels,
  creativeJobStatuses,
  creativePriorities,
  creativePriorityLabels,
  creativeTaxonomyCategoryLabels,
  creativeWorkloads,
  type CreativeAsset,
  type CreativeBriefVersion,
  type CreativeComment,
  type CreativeDesignerProfile,
  type CreativeJobRow,
  type CreativeNotification,
  type CreativeTaxonomyItem,
} from "@/lib/creative/types";

type BrandOption = { id: string; name: string };
type TreatmentOption = { id: string; name: string; brandId: string };

type CreativeJobStudioProps = {
  job: CreativeJobRow;
  assets: CreativeAsset[];
  comments: CreativeComment[];
  versions: CreativeBriefVersion[];
  notifications: CreativeNotification[];
  brands: BrandOption[];
  treatments: TreatmentOption[];
  taxonomies: CreativeTaxonomyItem[];
  designers: CreativeDesignerProfile[];
  canEditMetadata: boolean;
  canEditBrief: boolean;
  canUpdateStatus: boolean;
  canContributeAssets: boolean;
  canManageSettings: boolean;
  feedback?: CreativeJobFeedback;
  fixtureMode?: boolean;
};

type CreativeJobSettingsDraft = {
  title: string;
  brandId: string;
  treatmentId: string;
  assigneeProfileId: string;
  sourceTaxonomyId: string;
  usageTaxonomyId: string;
  mediaFormatTaxonomyId: string;
  quantity: string;
  workload: CreativeJobRow["workload"];
  specifications: string;
  startDate: string;
  startTime: string;
  dueDate: string;
  dueTime: string;
  priority: CreativeJobRow["priority"];
  materialStatus: "ready" | "waiting";
  syncCalendar: boolean;
  publishDate: string;
  publishTime: string;
  sourceUrl: string;
  referenceUrl: string;
  status: CreativeJobRow["status"];
};

type CreativeJobFeedback = {
  status: "success" | "error";
  message: string;
} | null;

function createSettingsDraft(job: CreativeJobRow): CreativeJobSettingsDraft {
  return {
    title: job.title,
    brandId: job.brandId,
    treatmentId: job.treatmentId || "",
    assigneeProfileId: job.assigneeProfileId || "",
    sourceTaxonomyId: job.sourceTaxonomyId || "",
    usageTaxonomyId: job.usageTaxonomyId || "",
    mediaFormatTaxonomyId: job.mediaFormatTaxonomyId || "",
    quantity: String(job.quantity),
    workload: job.workload,
    specifications: job.specifications || "",
    startDate: job.startDate,
    startTime: job.startTime || "",
    dueDate: job.dueDate || "",
    dueTime: job.dueTime || "",
    priority: job.priority,
    materialStatus: job.materialStatus,
    syncCalendar: job.syncCalendar,
    publishDate: job.publishDate || job.dueDate || "",
    publishTime: job.publishTime || "",
    sourceUrl: job.sourceUrl || "",
    referenceUrl: job.referenceUrl || "",
    status: job.status,
  };
}

function requesterDisplayName(name: string | null, email: string | null) {
  if (name?.trim()) return name.trim();
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) return "系統匯入";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function assetIcon(asset: CreativeAsset) {
  if (asset.mimeType?.startsWith("image/")) return FileImage;
  if (asset.purpose === "final" || asset.purpose === "draft") return FileText;
  return Link2;
}

function sectionClass() {
  return "overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white shadow-[0_10px_32px_rgba(90,35,72,0.045)]";
}

function fieldClass() {
  return "mt-1 w-full rounded-xl border border-[#dfcdc4] bg-white px-3 py-2.5 text-xs font-bold text-[#3d2232] outline-none transition focus:border-[#8e5a76] focus:ring-4 focus:ring-[#8e5a76]/10 disabled:bg-[#f5f1ef] disabled:text-[#947f8a]";
}

export function CreativeJobStudio(props: CreativeJobStudioProps) {
  const [draft, setDraft] = useState<CreativeJobSettingsDraft>(() =>
    createSettingsDraft(props.job)
  );
  const [fixtureFeedback, setFixtureFeedback] =
    useState<CreativeJobFeedback>(null);
  const returnPath = `/creative-jobs/${props.job.id}`;
  const feedback = fixtureFeedback ?? props.feedback ?? null;
  const fixtureMode = props.fixtureMode === true;
  const settingsDraftStorageKey = `creative-job-settings-draft:${props.job.id}`;

  useEffect(() => {
    try {
      if (feedback?.status === "error") {
        const savedDraft = window.sessionStorage.getItem(
          settingsDraftStorageKey
        );
        if (savedDraft) {
          const parsed = JSON.parse(
            savedDraft
          ) as Partial<CreativeJobSettingsDraft>;
          setDraft((current) => ({ ...current, ...parsed }));
        }
      } else {
        window.sessionStorage.removeItem(settingsDraftStorageKey);
      }
    } catch {
      // Session storage is an optional handoff for failed validation only.
    }

    if (feedback) {
      const url = new URL(window.location.href);
      url.searchParams.delete("creative_status");
      url.searchParams.delete("creative_message");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }
  }, [feedback, settingsDraftStorageKey]);


  function updateDraft<K extends keyof CreativeJobSettingsDraft>(
    key: K,
    value: CreativeJobSettingsDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }


  const treatments = useMemo(
    () => props.treatments.filter((item) => item.brandId === draft.brandId),
    [draft.brandId, props.treatments]
  );
  const activeTaxonomies = useMemo(() => {
    const currentIds = new Set([
      props.job.sourceTaxonomyId,
      props.job.usageTaxonomyId,
      props.job.mediaFormatTaxonomyId,
      draft.sourceTaxonomyId,
      draft.usageTaxonomyId,
      draft.mediaFormatTaxonomyId,
    ]);
    return props.taxonomies.filter(
      (item) => item.isActive || currentIds.has(item.id)
    );
  }, [draft.mediaFormatTaxonomyId, draft.sourceTaxonomyId, draft.usageTaxonomyId, props.job, props.taxonomies]);
  const availableDesigners = useMemo(
    () =>
      props.designers.filter(
        (item) => item.isActive || item.id === draft.assigneeProfileId
      ),
    [draft.assigneeProfileId, props.designers]
  );
  const selectedDesigner = availableDesigners.find(
    (item) => item.id === draft.assigneeProfileId
  );



  return (
    <div className="min-h-screen bg-[#fbf7f5] text-[#321428]">
      <header className="border-b border-[#ead9cf] bg-[#fffdfb] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1880px] flex-wrap items-center gap-3">
          <Link
            href="/creative-jobs"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dfcdc4] bg-white px-3 text-xs font-black text-[#6d4a5c] hover:border-[#caa9b7] hover:text-[#5a2348]"
          >
            <ArrowLeft size={15} /> Job List
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff0f5] px-2 py-1 text-[10px] font-black text-[#7c365f]">
                {props.job.brandName}
              </span>
              <span className="rounded-full bg-[#f7f1ed] px-2 py-1 text-[10px] font-black text-[#6d4a5c]">
                {creativeJobStatusLabels[props.job.status]}
              </span>
              {props.job.priority !== "normal" ? (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${
                    props.job.priority === "urgent"
                      ? "bg-[#fff0ef] text-[#a43b50]"
                      : "bg-[#fff7e8] text-[#94611f]"
                  }`}
                >
                  {creativePriorityLabels[props.job.priority]}
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 truncate text-lg font-black sm:text-xl">
              {props.job.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] font-bold text-[#806174]">
            <span
              className="inline-flex items-center gap-1"
              title={props.job.requesterEmail || undefined}
            >
              <UserRound size={13} /> 建立者 {requesterDisplayName(props.job.requesterName, props.job.requesterEmail)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 size={13} /> 最後更新 {prettyDateTime(props.job.updatedAt)}
            </span>
          </div>
          {props.canEditMetadata ? (
            <CreativeJobDeleteControl
              jobId={props.job.id}
              title={props.job.title}
              placement="header"
              fixtureMode={fixtureMode}
            />
          ) : null}
          {props.canManageSettings ? (
            <Link
              href="/settings/creative"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dfcdc4] bg-white px-3 text-xs font-black text-[#6d4a5c] hover:border-[#caa9b7]"
            >
              <Settings2 size={15} /> 分類及 Designer
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1880px] gap-4 p-4 sm:p-6 xl:grid-cols-[288px_minmax(0,1fr)] xl:items-start">
        <aside className="order-2 grid gap-4 xl:order-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
          <form
            action={fixtureMode ? undefined : updateCreativeJobAction}
            onSubmit={(event) => {
              if (fixtureMode) {
                event.preventDefault();
                setFixtureFeedback({
                  status: "success",
                  message: "設計工作已儲存；畫面設定保持不變。",
                });
                return;
              }
              try {
                window.sessionStorage.setItem(
                  settingsDraftStorageKey,
                  JSON.stringify(draft)
                );
              } catch {
                // Server validation remains authoritative when storage is unavailable.
              }
            }}
            data-testid="creative-job-settings-form"
            className={`${sectionClass()} grid gap-0`}
          >
            <input type="hidden" name="jobId" value={props.job.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <header className="border-b border-[#eadfd9] bg-[#fffaf7] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a5d76]">
                Job setting
              </p>
              <h2 className="mt-0.5 text-sm font-black">派 Job 設定</h2>
            </header>

            {feedback ? (
              <div
                data-testid="creative-job-settings-feedback"
                role={feedback.status === "error" ? "alert" : "status"}
                className={`mx-3 mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold leading-5 ${
                  feedback.status === "error"
                    ? "border-[#efc5c9] bg-[#fff4f5] text-[#a43b50]"
                    : "border-[#cfe4d8] bg-[#f2faf6] text-[#3f7f5f]"
                }`}
              >
                {feedback.status === "error" ? (
                  <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                ) : (
                  <CheckCircle2 className="mt-0.5 shrink-0" size={14} />
                )}
                <span>{feedback.message}</span>
              </div>
            ) : null}

            <details open className="group border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                基本資料
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  Job 名稱
                  <input
                    name="title"
                    value={draft.title}
                    onChange={(event) => updateDraft("title", event.target.value)}
                    className={fieldClass()}
                    required
                    disabled={!props.canEditMetadata}
                  />
                </label>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  品牌
                  <select
                    name="brandId"
                    value={draft.brandId}
                    onChange={(event) => {
                      const nextBrandId = event.target.value;
                      setDraft((current) => ({
                        ...current,
                        brandId: nextBrandId,
                        treatmentId: props.treatments.some(
                          (item) =>
                            item.id === current.treatmentId &&
                            item.brandId === nextBrandId
                        )
                          ? current.treatmentId
                          : "",
                      }));
                    }}
                    className={fieldClass()}
                    disabled={!props.canEditMetadata}
                  >
                    {props.brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  療程／Campaign
                  <select
                    name="treatmentId"
                    value={draft.treatmentId}
                    onChange={(event) =>
                      updateDraft("treatmentId", event.target.value)
                    }
                    className={fieldClass()}
                    disabled={!props.canEditMetadata}
                  >
                    <option value="">不指定療程</option>
                    {treatments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  負責 Designer
                  <select
                    name="assigneeProfileId"
                    value={draft.assigneeProfileId}
                    onChange={(event) =>
                      updateDraft("assigneeProfileId", event.target.value)
                    }
                    className={fieldClass()}
                    disabled={!props.canEditMetadata}
                  >
                    <option value="">未派 Designer</option>
                    {availableDesigners.map((designer) => (
                      <option key={designer.id} value={designer.id}>
                        {designer.displayName}
                        {designer.linkedMemberId ? " · 已連結帳戶" : " · 未連結帳戶"}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedDesigner && !selectedDesigner.linkedMemberId ? (
                  <p className="rounded-xl bg-[#fff7e8] p-2.5 text-[10px] font-bold leading-4 text-[#85591f]">
                    {selectedDesigner.displayName} 未連結個人帳戶；可以先派 Job，但對方暫時收唔到系統及桌面通知。
                  </p>
                ) : null}
              </div>
            </details>

            <details open className="border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                分類及規格
              </summary>
              <div className="mt-3 grid gap-3">
                {(["source", "usage", "media_format"] as const).map(
                  (category) => (
                    <label
                      key={category}
                      className="text-[11px] font-black text-[#6d4a5c]"
                    >
                      {creativeTaxonomyCategoryLabels[category]}
                      <select
                        name={`${
                          category === "source"
                            ? "source"
                            : category === "usage"
                              ? "usage"
                              : "mediaFormat"
                        }TaxonomyId`}
                        value={
                          category === "source"
                            ? draft.sourceTaxonomyId
                            : category === "usage"
                              ? draft.usageTaxonomyId
                              : draft.mediaFormatTaxonomyId
                        }
                        onChange={(event) => {
                          if (category === "source") {
                            updateDraft("sourceTaxonomyId", event.target.value);
                          } else if (category === "usage") {
                            updateDraft("usageTaxonomyId", event.target.value);
                          } else {
                            updateDraft("mediaFormatTaxonomyId", event.target.value);
                          }
                        }}
                        className={fieldClass()}
                        disabled={!props.canEditMetadata}
                      >
                        <option value="">未選擇</option>
                        {activeTaxonomies
                          .filter((item) => item.category === category)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                              {!item.isActive ? " · 已停用" : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                  )
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    數量
                    <input
                      name="quantity"
                      type="number"
                      min={1}
                      max={999}
                      value={draft.quantity}
                      onChange={(event) => updateDraft("quantity", event.target.value)}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    工作量
                    <select
                      name="workload"
                      value={draft.workload}
                      onChange={(event) =>
                        updateDraft(
                          "workload",
                          event.target.value as CreativeJobRow["workload"]
                        )
                      }
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    >
                      {creativeWorkloads.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  尺寸／片長／輸出規格
                  <textarea
                    name="specifications"
                    value={draft.specifications}
                    onChange={(event) =>
                      updateDraft("specifications", event.target.value)
                    }
                    rows={4}
                    className={fieldClass()}
                    placeholder="例如：9:16 × 3、每條 20–30 秒、有字幕、保留 Logo 位"
                    disabled={!props.canEditMetadata}
                  />
                </label>
              </div>
            </details>

            <details open className="border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                排程及優先級
              </summary>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    Start Day
                    <input
                      name="startDate"
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => updateDraft("startDate", event.target.value)}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                      required
                    />
                  </label>
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    Start Time
                    <input
                      name="startTime"
                      type="time"
                      value={draft.startTime}
                      onChange={(event) => updateDraft("startTime", event.target.value)}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    Due Day
                    <input
                      name="dueDate"
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) => updateDraft("dueDate", event.target.value)}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    Due Time
                    <input
                      name="dueTime"
                      type="time"
                      value={draft.dueTime}
                      onChange={(event) => updateDraft("dueTime", event.target.value)}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                </div>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  優先處理
                  <select
                    name="priority"
                    value={draft.priority}
                    onChange={(event) =>
                      updateDraft(
                        "priority",
                        event.target.value as CreativeJobRow["priority"]
                      )
                    }
                    className={fieldClass()}
                    disabled={!props.canEditMetadata}
                  >
                    {creativePriorities.map((value) => (
                      <option key={value} value={value}>
                        {creativePriorityLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  素材狀態
                  <select
                    name="materialStatus"
                    value={draft.materialStatus}
                    onChange={(event) =>
                      updateDraft(
                        "materialStatus",
                        event.target.value as "ready" | "waiting"
                      )
                    }
                    className={fieldClass()}
                    disabled={!props.canEditMetadata}
                  >
                    <option value="ready">素材已齊備</option>
                    <option value="waiting">等素材</option>
                  </select>
                </label>
              </div>
            </details>

            <details open className="border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                出街及營銷日曆
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#e4d5ce] bg-[#fffaf7] p-3">
                  <input
                    name="syncCalendar"
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.syncCalendar}
                    onChange={(event) =>
                      updateDraft("syncCalendar", event.target.checked)
                    }
                    disabled={!props.canEditMetadata}
                  />
                  <span>
                    <strong className="block text-[11px]">同步營銷日曆</strong>
                    <small className="mt-1 block text-[10px] font-semibold leading-4 text-[#806174]">
                      Job List 跟 Start Day；日曆同出街跟 Publish Day。
                    </small>
                  </span>
                </label>
                {draft.syncCalendar ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f6fbfc] p-3">
                    <label className="text-[11px] font-black text-[#53677e]">
                      Publish Day
                      <input
                        name="publishDate"
                        type="date"
                        value={draft.publishDate}
                        onChange={(event) =>
                          updateDraft("publishDate", event.target.value)
                        }
                        className={fieldClass()}
                        disabled={!props.canEditMetadata}
                        required
                      />
                    </label>
                    <label className="text-[11px] font-black text-[#53677e]">
                      Publish Time
                      <input
                        name="publishTime"
                        type="time"
                        value={draft.publishTime}
                        onChange={(event) =>
                          updateDraft("publishTime", event.target.value)
                        }
                        className={fieldClass()}
                        disabled={!props.canEditMetadata}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </details>

            <details open className="border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                快速素材連結
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  Source Folder URL
                  <input
                    name="sourceUrl"
                    type="url"
                    value={draft.sourceUrl}
                    onChange={(event) => updateDraft("sourceUrl", event.target.value)}
                    className={fieldClass()}
                    placeholder="https://drive.google.com/..."
                    disabled={!props.canEditMetadata}
                  />
                </label>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  Reference URL
                  <input
                    name="referenceUrl"
                    type="url"
                    value={draft.referenceUrl}
                    onChange={(event) =>
                      updateDraft("referenceUrl", event.target.value)
                    }
                    className={fieldClass()}
                    placeholder="https://..."
                    disabled={!props.canEditMetadata}
                  />
                </label>
              </div>
            </details>

            <div className="sticky bottom-0 z-10 grid gap-3 border-t border-[#eadfd9] bg-white/95 p-4 backdrop-blur">
              <label className="text-[11px] font-black text-[#6d4a5c]">
                工作狀態
                <select
                  name="status"
                  value={draft.status}
                  onChange={(event) =>
                    updateDraft(
                      "status",
                      event.target.value as CreativeJobRow["status"]
                    )
                  }
                  className={fieldClass()}
                  disabled={!props.canEditMetadata}
                >
                  {creativeJobStatuses.map((status) => (
                    <option key={status} value={status}>
                      {creativeJobStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              {props.canEditMetadata ? (
                <SubmitButton
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5a2348] px-4 text-xs font-black text-white shadow-[0_8px_20px_rgba(90,35,72,0.18)]"
                  pendingLabel="儲存設定中…"
                >
                  <Save size={15} /> 儲存 Job 設定
                </SubmitButton>
              ) : null}
            </div>
          </form>

          {props.canUpdateStatus && !props.canEditMetadata ? (
            <form
              action={fixtureMode ? undefined : updateCreativeJobStatusAction}
              onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}
              className={`${sectionClass()} p-4`}
            >
              <input type="hidden" name="jobId" value={props.job.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label className="text-[11px] font-black text-[#6d4a5c]">
                更新製作狀態
                <select
                  name="status"
                  defaultValue={props.job.status}
                  className={fieldClass()}
                >
                  <option value="waiting_assets">等素材</option>
                  <option value="in_progress">製作中</option>
                  <option value="review">提交 Review</option>
                  <option value="delivered">Final 已交付</option>
                  <option value="blocked">有阻礙</option>
                </select>
              </label>
              <SubmitButton
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#5a2348] px-3 text-xs font-black text-white"
                pendingLabel="更新中…"
              >
                <CheckCircle2 size={14} /> 更新狀態
              </SubmitButton>
            </form>
          ) : null}

        </aside>

        <section className="order-1 min-w-0 xl:order-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9a5d76]">
                Creative brief workspace
              </p>
              <h2 className="mt-0.5 text-lg font-black">完整 Brief 工作區</h2>
              <p className="mt-1 text-xs font-semibold text-[#806174]">
                長文、圖片、Screenshot、Checklist 同連結可以自由混排；唔再係細 Textarea。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.sourceUrl ? (
                <a
                  href={draft.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-black text-[#6d4a5c]"
                >
                  <FolderOpen size={13} /> Source Folder
                </a>
              ) : null}
              {draft.referenceUrl ? (
                <a
                  href={draft.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-black text-[#6d4a5c]"
                >
                  <ExternalLink size={13} /> Reference
                </a>
              ) : null}
              <CreativeBriefHistoryDialog
                jobId={props.job.id}
                returnPath={returnPath}
                versions={props.versions}
                canRestore={props.canEditBrief}
                fixtureMode={fixtureMode}
              />
            </div>
          </div>
          <CreativeBriefEditor
            jobId={props.job.id}
            initialDocument={props.job.briefDocument}
            editable={props.canEditBrief}
            persistenceEnabled={!fixtureMode}
          />
        </section>

      </main>
    </div>
  );
}
