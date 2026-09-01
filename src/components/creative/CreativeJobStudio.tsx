"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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
import { CreativeJobDeleteButton } from "@/components/creative/CreativeJobDeleteButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  CreativeBriefEditor,
  type CreativeBriefEditorHandle,
} from "@/components/creative/CreativeBriefEditor";
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
};

type RightPanel = "assets" | "discussion" | "history";

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
  const [brandId, setBrandId] = useState(props.job.brandId);
  const [syncCalendar, setSyncCalendar] = useState(props.job.syncCalendar);
  const [rightPanel, setRightPanel] = useState<RightPanel>("assets");
  const [assets, setAssets] = useState(props.assets);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadPurpose, setUploadPurpose] = useState<CreativeAsset["purpose"]>(
    "source"
  );
  const editorRef = useRef<CreativeBriefEditorHandle | null>(null);
  const returnPath = `/creative-jobs/${props.job.id}`;

  const treatments = useMemo(
    () => props.treatments.filter((item) => item.brandId === brandId),
    [brandId, props.treatments]
  );
  const activeTaxonomies = useMemo(() => {
    const currentIds = new Set([
      props.job.sourceTaxonomyId,
      props.job.usageTaxonomyId,
      props.job.mediaFormatTaxonomyId,
    ]);
    return props.taxonomies.filter(
      (item) => item.isActive || currentIds.has(item.id)
    );
  }, [props.job, props.taxonomies]);
  const availableDesigners = useMemo(
    () =>
      props.designers.filter(
        (item) => item.isActive || item.id === props.job.assigneeProfileId
      ),
    [props.designers, props.job.assigneeProfileId]
  );
  const selectedDesigner = availableDesigners.find(
    (item) => item.id === props.job.assigneeProfileId
  );

  async function uploadAssetFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setUploadMessage("");
    try {
      const created: CreativeAsset[] = [];
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        body.set("purpose", uploadPurpose);
        body.set("label", file.name || "Creative asset");
        const response = await fetch(
          `/api/creative-jobs/${props.job.id}/assets`,
          { method: "POST", body }
        );
        const result = (await response.json().catch(() => ({}))) as {
          asset?: CreativeAsset;
          error?: string;
        };
        if (!response.ok || !result.asset) {
          throw new Error(result.error || "upload_failed");
        }
        created.push(result.asset);
      }
      setAssets((current) => [
        ...created,
        ...current.filter(
          (item) => !created.some((createdItem) => createdItem.id === item.id)
        ),
      ]);
      setUploadMessage(`${created.length} 個素材已安全儲存。`);
    } catch (error) {
      setUploadMessage(
        error instanceof Error && error.message === "file_too_large"
          ? "圖片大過 25MB，請先壓縮。"
          : "素材上載失敗，請稍後再試。"
      );
    } finally {
      setUploading(false);
    }
  }

  function handleBriefAssetCreated(asset: CreativeAsset) {
    setAssets((current) => [
      asset,
      ...current.filter((item) => item.id !== asset.id),
    ]);
  }

  return (
    <div className="min-h-screen bg-[#fbf7f5] text-[#321428]">
      <header className="sticky top-0 z-30 border-b border-[#ead9cf] bg-[#fffdfb]/95 px-4 py-3 backdrop-blur-xl sm:px-6">
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
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#806174]">
            <Clock3 size={13} /> 最後更新 {prettyDateTime(props.job.updatedAt)}
          </div>
          {props.canManageSettings ? (
            <Link
              href="/settings/creative"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dfcdc4] bg-white px-3 text-xs font-black text-[#6d4a5c] hover:border-[#caa9b7]"
            >
              <Settings2 size={15} /> 分類及 Designer
            </Link>
          ) : null}
          {props.canEditMetadata ? (
            <CreativeJobDeleteButton jobId={props.job.id} title={props.job.title} />
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1880px] gap-4 p-4 sm:p-6 xl:grid-cols-[310px_minmax(620px,1fr)_350px] xl:items-start">
        <aside className="order-2 grid gap-4 xl:order-1">
          <form
            action={updateCreativeJobAction}
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

            <details open className="group border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                基本資料
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  Job 名稱
                  <input
                    name="title"
                    defaultValue={props.job.title}
                    className={fieldClass()}
                    required
                    disabled={!props.canEditMetadata}
                  />
                </label>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  品牌
                  <select
                    name="brandId"
                    value={brandId}
                    onChange={(event) => setBrandId(event.target.value)}
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
                    defaultValue={
                      treatments.some((item) => item.id === props.job.treatmentId)
                        ? props.job.treatmentId || ""
                        : ""
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
                    defaultValue={props.job.assigneeProfileId || ""}
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
                        defaultValue={
                          category === "source"
                            ? props.job.sourceTaxonomyId || ""
                            : category === "usage"
                              ? props.job.usageTaxonomyId || ""
                              : props.job.mediaFormatTaxonomyId || ""
                        }
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
                      defaultValue={props.job.quantity}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    工作量
                    <select
                      name="workload"
                      defaultValue={props.job.workload}
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
                    defaultValue={props.job.specifications || ""}
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
                      defaultValue={props.job.startDate}
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
                      defaultValue={props.job.startTime || ""}
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
                      defaultValue={props.job.dueDate || ""}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                  <label className="text-[11px] font-black text-[#6d4a5c]">
                    Due Time
                    <input
                      name="dueTime"
                      type="time"
                      defaultValue={props.job.dueTime || ""}
                      className={fieldClass()}
                      disabled={!props.canEditMetadata}
                    />
                  </label>
                </div>
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  優先處理
                  <select
                    name="priority"
                    defaultValue={props.job.priority}
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
                    defaultValue={props.job.materialStatus}
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
                    checked={syncCalendar}
                    onChange={(event) => setSyncCalendar(event.target.checked)}
                    disabled={!props.canEditMetadata}
                  />
                  <span>
                    <strong className="block text-[11px]">同步營銷日曆</strong>
                    <small className="mt-1 block text-[10px] font-semibold leading-4 text-[#806174]">
                      Job List 跟 Start Day；日曆同出街跟 Publish Day。
                    </small>
                  </span>
                </label>
                {syncCalendar ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f6fbfc] p-3">
                    <label className="text-[11px] font-black text-[#53677e]">
                      Publish Day
                      <input
                        name="publishDate"
                        type="date"
                        defaultValue={
                          props.job.publishDate || props.job.dueDate || ""
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
                        defaultValue={props.job.publishTime || ""}
                        className={fieldClass()}
                        disabled={!props.canEditMetadata}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </details>

            <details className="border-b border-[#eee3dd] p-4">
              <summary className="cursor-pointer list-none text-xs font-black">
                快速素材連結
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="text-[11px] font-black text-[#6d4a5c]">
                  Source Folder URL
                  <input
                    name="sourceUrl"
                    type="url"
                    defaultValue={props.job.sourceUrl || ""}
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
                    defaultValue={props.job.referenceUrl || ""}
                    className={fieldClass()}
                    placeholder="https://..."
                    disabled={!props.canEditMetadata}
                  />
                </label>
              </div>
            </details>

            <div className="grid gap-3 p-4">
              <label className="text-[11px] font-black text-[#6d4a5c]">
                工作狀態
                <select
                  name="status"
                  defaultValue={props.job.status}
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
            <form action={updateCreativeJobStatusAction} className={`${sectionClass()} p-4`}>
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

          {props.canEditMetadata ? (
            <CreativeJobDeleteButton
              jobId={props.job.id}
              title={props.job.title}
              fullWidth
            />
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
              {props.job.sourceUrl ? (
                <a
                  href={props.job.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-black text-[#6d4a5c]"
                >
                  <FolderOpen size={13} /> Source Folder
                </a>
              ) : null}
              {props.job.referenceUrl ? (
                <a
                  href={props.job.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-black text-[#6d4a5c]"
                >
                  <ExternalLink size={13} /> Reference
                </a>
              ) : null}
            </div>
          </div>
          <CreativeBriefEditor
            ref={editorRef}
            jobId={props.job.id}
            initialDocument={props.job.briefDocument}
            editable={props.canEditBrief}
            onAssetCreated={handleBriefAssetCreated}
          />
        </section>

        <aside className="order-3 min-w-0 xl:sticky xl:top-[86px] xl:max-h-[calc(100vh-106px)]">
          <section className={`${sectionClass()} flex max-h-[calc(100vh-106px)] min-h-[640px] flex-col`}>
            <header className="border-b border-[#eadfd9] bg-[#fffaf7] p-3">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f5eeeb] p-1">
                {(
                  [
                    ["assets", "素材", Paperclip],
                    ["discussion", "討論", MessageSquareText],
                    ["history", "版本", History],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRightPanel(value)}
                    className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg text-[10px] font-black transition ${
                      rightPanel === value
                        ? "bg-white text-[#5a2348] shadow-sm"
                        : "text-[#806174] hover:text-[#5a2348]"
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {rightPanel === "assets" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-[#eadfd9] bg-[#fffdfb] p-3">
                    <div className="flex items-center gap-2">
                      <UploadCloud size={16} className="text-[#7c365f]" />
                      <div>
                        <strong className="block text-xs">Job 素材庫</strong>
                        <small className="text-[10px] font-semibold text-[#806174]">
                          圖片可貼入 Brief；大型影片建議放 Google Drive Link。
                        </small>
                      </div>
                    </div>
                    {props.canContributeAssets ? (
                      <div className="mt-3 grid gap-2">
                        <select
                          value={uploadPurpose}
                          onChange={(event) =>
                            setUploadPurpose(
                              event.target.value as CreativeAsset["purpose"]
                            )
                          }
                          className={fieldClass()}
                        >
                          {creativeAssetPurposes.map((purpose) => (
                            <option key={purpose} value={purpose}>
                              {creativeAssetPurposeLabels[purpose]}
                            </option>
                          ))}
                        </select>
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#5a2348] px-3 text-[10px] font-black text-white">
                          <ImagePlus size={14} />
                          {uploading ? "上載中…" : "上載圖片"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            hidden
                            disabled={uploading}
                            onChange={uploadAssetFiles}
                          />
                        </label>
                        {uploadMessage ? (
                          <p className="text-[10px] font-bold text-[#6d4a5c]">
                            {uploadMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {props.canContributeAssets ? (
                    <form
                      action={addCreativeLinkAssetAction}
                      className="grid gap-2 rounded-xl border border-[#eadfd9] bg-white p-3"
                    >
                      <input type="hidden" name="jobId" value={props.job.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <strong className="text-xs">加入 Google Drive／素材連結</strong>
                      <input
                        name="label"
                        placeholder="素材名稱，例如 KOL Raw Footage"
                        className={fieldClass()}
                        required
                      />
                      <input
                        name="url"
                        type="url"
                        placeholder="https://drive.google.com/..."
                        className={fieldClass()}
                        required
                      />
                      <select name="purpose" className={fieldClass()} defaultValue="source">
                        {creativeAssetPurposes.map((purpose) => (
                          <option key={purpose} value={purpose}>
                            {creativeAssetPurposeLabels[purpose]}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#dfcdc4] bg-[#fffaf7] text-[10px] font-black text-[#5a2348]"
                        pendingLabel="加入中…"
                      >
                        <Link2 size={13} /> 加入素材庫
                      </SubmitButton>
                    </form>
                  ) : null}

                  <div className="grid gap-2">
                    {assets.length ? (
                      assets.map((asset) => {
                        const Icon = assetIcon(asset);
                        return (
                          <article
                            key={asset.id}
                            className="rounded-xl border border-[#eadfd9] bg-white p-3"
                          >
                            <div className="flex items-start gap-2">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fff0f5] text-[#7c365f]">
                                <Icon size={15} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <strong className="block truncate text-[11px]">
                                  {asset.label}
                                </strong>
                                <small className="mt-0.5 block text-[9px] font-bold text-[#927987]">
                                  {creativeAssetPurposeLabels[asset.purpose]} · {prettyDateTime(asset.createdAt)}
                                </small>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <a
                                href={asset.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#dfcdc4] px-2 text-[9px] font-black text-[#6d4a5c]"
                              >
                                <ExternalLink size={11} /> 開啟
                              </a>
                              {props.canEditBrief ? (
                                <button
                                  type="button"
                                  onClick={() => editorRef.current?.insertAsset(asset)}
                                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#5a2348] px-2 text-[9px] font-black text-white"
                                >
                                  <Paperclip size={11} /> 插入 Workspace
                                </button>
                              ) : null}
                              {props.canContributeAssets ? (
                                <form action={removeCreativeAssetAction}>
                                  <input type="hidden" name="jobId" value={props.job.id} />
                                  <input type="hidden" name="assetId" value={asset.id} />
                                  <input type="hidden" name="returnPath" value={returnPath} />
                                  <ConfirmSubmitButton
                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#e5c5c8] px-2 text-[9px] font-black text-[#a43b50]"
                                    pendingLabel="移除中…"
                                    confirmMessage="只會解除呢張 Job 嘅連結；Google Drive 原檔唔會被刪除。確定移除？"
                                  >
                                    <Trash2 size={11} /> 移除
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#dfc5d0] bg-[#fff9fb] p-6 text-center">
                        <Paperclip className="mx-auto text-[#a17b8d]" size={20} />
                        <p className="mt-2 text-[10px] font-bold text-[#806174]">
                          暫時未有素材。可直接貼圖入 Brief，或喺上面加入 Drive Link。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {rightPanel === "discussion" ? (
                <div className="grid gap-3">
                  {props.canContributeAssets ? (
                    <form
                      action={addCreativeCommentAction}
                      className="grid gap-2 rounded-xl border border-[#eadfd9] bg-white p-3"
                    >
                      <input type="hidden" name="jobId" value={props.job.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <label className="text-xs font-black">
                        留言／修改要求
                        <textarea
                          name="body"
                          rows={4}
                          className={fieldClass()}
                          placeholder="寫低問題、欠缺素材、修改內容或 Review 意見…"
                          required
                        />
                      </label>
                      <SubmitButton
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#5a2348] text-[10px] font-black text-white"
                        pendingLabel="送出中…"
                      >
                        <Send size={12} /> 送出留言
                      </SubmitButton>
                    </form>
                  ) : null}
                  {props.comments.length ? (
                    props.comments.map((comment) => (
                      <article
                        key={comment.id}
                        className="rounded-xl border border-[#eadfd9] bg-white p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#fff0f5] text-[#7c365f]">
                            <UserRound size={13} />
                          </span>
                          <div>
                            <strong className="block text-[10px]">
                              {comment.authorName || comment.authorEmail || "團隊成員"}
                            </strong>
                            <small className="text-[9px] text-[#927987]">
                              {prettyDateTime(comment.createdAt)}
                            </small>
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[11px] font-semibold leading-5 text-[#5f4052]">
                          {comment.body}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="p-6 text-center text-[10px] font-bold text-[#806174]">
                      暫時未有討論。
                    </p>
                  )}
                </div>
              ) : null}

              {rightPanel === "history" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl bg-[#fffaf7] p-3">
                    <strong className="text-xs">Brief 版本</strong>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-[#806174]">
                      系統每隔一段時間自動留底；重大改動可喺 Brief 工具列按「儲存版本」。
                    </p>
                  </div>
                  {props.versions.length ? (
                    props.versions.map((version) => (
                      <article
                        key={version.id}
                        className="rounded-xl border border-[#eadfd9] bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <strong className="block text-[11px]">
                              Version {version.versionNo}
                            </strong>
                            <small className="text-[9px] font-bold text-[#927987]">
                              {prettyDateTime(version.createdAt)} · {version.createdByEmail || "系統"}
                            </small>
                          </div>
                          {props.canEditBrief ? (
                            <form action={restoreCreativeBriefVersionAction}>
                              <input type="hidden" name="jobId" value={props.job.id} />
                              <input type="hidden" name="versionId" value={version.id} />
                              <input type="hidden" name="returnPath" value={returnPath} />
                              <ConfirmSubmitButton
                                className="rounded-lg border border-[#dfcdc4] px-2 py-1 text-[9px] font-black text-[#5a2348]"
                                pendingLabel="恢復中…"
                                confirmMessage={`確定恢復 Version ${version.versionNo}？目前版本仍會保留。`}
                              >
                                恢復
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="p-6 text-center text-[10px] font-bold text-[#806174]">
                      完成第一次自動儲存後會出現版本。
                    </p>
                  )}

                  <div className="border-t border-[#eadfd9] pt-3">
                    <strong className="text-xs">我的通知</strong>
                    <div className="mt-2 grid gap-2">
                      {props.notifications.length ? (
                        props.notifications.map((notification) => (
                          <article
                            key={notification.id}
                            className={`rounded-xl border p-3 ${
                              notification.isRead
                                ? "border-[#eadfd9] bg-white"
                                : "border-[#d9a9bd] bg-[#fff7fa]"
                            }`}
                          >
                            <strong className="block text-[10px]">
                              {notification.title}
                            </strong>
                            {notification.body ? (
                              <p className="mt-1 text-[10px] font-semibold text-[#6d4a5c]">
                                {notification.body}
                              </p>
                            ) : null}
                            {!notification.isRead ? (
                              <form
                                action={markCreativeNotificationReadAction}
                                className="mt-2"
                              >
                                <input type="hidden" name="notificationId" value={notification.id} />
                                <input type="hidden" name="returnPath" value={returnPath} />
                                <button className="text-[9px] font-black text-[#7c365f]">
                                  標記已讀
                                </button>
                              </form>
                            ) : null}
                          </article>
                        ))
                      ) : (
                        <p className="text-[10px] font-semibold text-[#927987]">
                          暫時冇通知。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
