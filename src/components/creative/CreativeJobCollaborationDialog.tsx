"use client";

import { useState, type ChangeEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  ExternalLink,
  FileImage,
  FileText,
  ImagePlus,
  Link2,
  MessageSquareText,
  Paperclip,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { addCreativeCommentAction, addCreativeLinkAssetAction, removeCreativeAssetAction } from "@/app/creative-jobs/actions";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import { SystemButton } from "@/components/system/SystemButton";
import { buttonVariants } from "@/components/ui/button";
import {
  creativeAssetPurposeLabels,
  type CreativeAsset,
  type CreativeComment,
} from "@/lib/creative/types";
import { cn } from "@/lib/utils";

const productionAssetPurposes = [
  "source",
  "reference",
  "draft",
  "final",
] as const;

type ProductionAssetPurpose = (typeof productionAssetPurposes)[number];
type CollaborationPanel = "deliverables" | "comments";

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
  if (asset.purpose === "draft" || asset.purpose === "final") return FileText;
  return Link2;
}

function fieldClass() {
  return "w-full rounded-[var(--radius-control)] border border-system-border bg-system-background px-3 py-2.5 text-sm font-semibold text-system-foreground outline-none transition focus:border-system-ring focus:ring-3 focus:ring-system-ring/20";
}

type CreativeJobCollaborationDialogProps = {
  jobId: string;
  returnPath: string;
  assets: CreativeAsset[];
  comments: CreativeComment[];
  canContribute: boolean;
  fixtureMode?: boolean;
  defaultOpen?: boolean;
};

export function CreativeJobCollaborationDialog({
  jobId,
  returnPath,
  assets,
  comments,
  canContribute,
  fixtureMode = false,
  defaultOpen = false,
}: CreativeJobCollaborationDialogProps) {
  const [activePanel, setActivePanel] =
    useState<CollaborationPanel>("deliverables");
  const [productionAssets, setProductionAssets] = useState(() =>
    assets.filter((asset) => asset.purpose !== "brief")
  );
  const [uploadPurpose, setUploadPurpose] =
    useState<ProductionAssetPurpose>("draft");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  if (!canContribute && productionAssets.length === 0 && comments.length === 0) {
    return null;
  }

  async function uploadAssetFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (fixtureMode) {
      setUploadMessage("測試模式不會真正上載檔案。");
      return;
    }

    setUploading(true);
    setUploadMessage("");
    try {
      const created: CreativeAsset[] = [];
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        body.set("purpose", uploadPurpose);
        body.set("label", file.name || "Creative deliverable");
        const response = await fetch(`/api/creative-jobs/${jobId}/assets`, {
          method: "POST",
          body,
        });
        const result = (await response.json().catch(() => ({}))) as {
          asset?: CreativeAsset;
          error?: string;
        };
        if (!response.ok || !result.asset) {
          throw new Error(result.error || "upload_failed");
        }
        created.push(result.asset);
      }
      setProductionAssets((current) => [
        ...created,
        ...current.filter(
          (item) => !created.some((createdItem) => createdItem.id === item.id)
        ),
      ]);
      setUploadMessage(`${created.length} 個交付檔案已安全儲存。`);
    } catch (error) {
      setUploadMessage(
        error instanceof Error && error.message === "file_too_large"
          ? "檔案大過 25MB，請改用 Google Drive Link。"
          : "交付檔案上載失敗，請稍後再試。"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog.Root defaultOpen={defaultOpen}>
      <Dialog.Trigger
        render={
          <SystemButton
            density="compact"
            variant="outline"
            data-testid="creative-collaboration-trigger"
          >
            <Paperclip size={14} aria-hidden="true" />
            交付／留言
            <span className="rounded-full bg-system-muted px-1.5 py-0.5 text-[10px] font-black text-system-muted-foreground">
              {productionAssets.length + comments.length}
            </span>
          </SystemButton>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/35 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-testid="creative-collaboration-dialog"
          className="fixed inset-y-0 right-0 z-[100] flex h-[100dvh] w-[min(470px,calc(100vw-0.75rem))] flex-col border-l border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:translate-x-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-x-4 data-[starting-style]:opacity-0"
        >
          <header className="flex items-start gap-3 border-b border-system-border px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-secondary text-system-secondary-foreground">
              <Paperclip size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-black tracking-[-0.02em]">
                交付與留言
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-semibold leading-5 text-system-muted-foreground">
                呢度只放真正 Raw、Draft、Final 或 Drive Link；Brief Screenshot 只作解釋，不會列入交付素材。
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="關閉交付與留言"
              title="關閉"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "shrink-0 rounded-[var(--radius-control)]"
              )}
            >
              <X size={15} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="border-b border-system-border bg-system-muted/45 p-3">
            <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-system-background p-1">
              <button
                type="button"
                data-testid="creative-deliverables-tab"
                onClick={() => setActivePanel("deliverables")}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-xs font-black transition",
                  activePanel === "deliverables"
                    ? "bg-system-primary text-system-primary-foreground shadow-sm"
                    : "text-system-muted-foreground hover:bg-system-muted hover:text-system-foreground"
                )}
              >
                <UploadCloud size={13} aria-hidden="true" />
                交付 {productionAssets.length}
              </button>
              <button
                type="button"
                data-testid="creative-comments-tab"
                onClick={() => setActivePanel("comments")}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-xs font-black transition",
                  activePanel === "comments"
                    ? "bg-system-primary text-system-primary-foreground shadow-sm"
                    : "text-system-muted-foreground hover:bg-system-muted hover:text-system-foreground"
                )}
              >
                <MessageSquareText size={13} aria-hidden="true" />
                留言 {comments.length}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {activePanel === "deliverables" ? (
              <div className="grid gap-4">
                {canContribute ? (
                  <>
                    <section className="grid gap-2.5 rounded-[var(--radius-card)] border border-system-border bg-system-background p-3.5">
                      <div className="flex items-start gap-2">
                        <ImagePlus className="mt-0.5 text-system-primary" size={16} />
                        <div>
                          <strong className="block text-sm">上載交付圖片</strong>
                          <p className="mt-0.5 text-xs font-semibold leading-5 text-system-muted-foreground">
                            大型影片請放 Google Drive；呢度適合 Draft／Final 圖或預覽圖。
                          </p>
                        </div>
                      </div>
                      <select
                        value={uploadPurpose}
                        onChange={(event) =>
                          setUploadPurpose(
                            event.target.value as ProductionAssetPurpose
                          )
                        }
                        className={fieldClass()}
                        aria-label="交付檔案類型"
                      >
                        {productionAssetPurposes.map((purpose) => (
                          <option key={purpose} value={purpose}>
                            {creativeAssetPurposeLabels[purpose]}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] bg-system-primary px-3 text-xs font-black text-system-primary-foreground hover:bg-system-primary/85">
                        <ImagePlus size={14} aria-hidden="true" />
                        {uploading ? "上載中…" : "選擇圖片"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          hidden
                          disabled={uploading}
                          onChange={(event) => void uploadAssetFiles(event)}
                        />
                      </label>
                      {uploadMessage ? (
                        <p className="text-xs font-semibold text-system-muted-foreground">
                          {uploadMessage}
                        </p>
                      ) : null}
                    </section>

                    <form
                      action={fixtureMode ? undefined : addCreativeLinkAssetAction}
                      onSubmit={
                        fixtureMode ? (event) => event.preventDefault() : undefined
                      }
                      className="grid gap-2.5 rounded-[var(--radius-card)] border border-system-border bg-system-background p-3.5"
                    >
                      <input type="hidden" name="jobId" value={jobId} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <strong className="text-sm">加入 Google Drive／交付連結</strong>
                      <input
                        name="label"
                        placeholder="名稱，例如 KOL Raw Footage／Final V2"
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
                      <select
                        name="purpose"
                        className={fieldClass()}
                        defaultValue="draft"
                        aria-label="交付連結類型"
                      >
                        {productionAssetPurposes.map((purpose) => (
                          <option key={purpose} value={purpose}>
                            {creativeAssetPurposeLabels[purpose]}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-system-border bg-system-card px-3 text-xs font-black text-system-primary"
                        pendingLabel="加入中…"
                      >
                        <Link2 size={13} aria-hidden="true" /> 加入交付
                      </SubmitButton>
                    </form>
                  </>
                ) : null}

                <section className="grid gap-2.5" aria-label="已提交交付">
                  {productionAssets.length ? (
                    productionAssets.map((asset) => {
                      const Icon = assetIcon(asset);
                      return (
                        <article
                          key={asset.id}
                          className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-secondary text-system-secondary-foreground">
                              <Icon size={14} aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <strong className="block truncate text-sm">
                                {asset.label}
                              </strong>
                              <small className="mt-0.5 block text-[11px] font-semibold text-system-muted-foreground">
                                {creativeAssetPurposeLabels[asset.purpose]} · {prettyDateTime(asset.createdAt)}
                              </small>
                            </div>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <a
                              href={asset.url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "rounded-[var(--radius-control)]"
                              )}
                            >
                              <ExternalLink size={12} aria-hidden="true" /> 開啟
                            </a>
                            {canContribute ? (
                              <form
                                action={
                                  fixtureMode ? undefined : removeCreativeAssetAction
                                }
                                onSubmit={
                                  fixtureMode
                                    ? (event) => event.preventDefault()
                                    : undefined
                                }
                              >
                                <input type="hidden" name="jobId" value={jobId} />
                                <input type="hidden" name="assetId" value={asset.id} />
                                <input
                                  type="hidden"
                                  name="returnPath"
                                  value={returnPath}
                                />
                                <ConfirmSubmitButton
                                  className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-system-destructive/25 px-2.5 text-xs font-black text-system-destructive"
                                  pendingLabel="移除中…"
                                  confirmMessage="只會解除呢張 Job 嘅交付連結；Google Drive 原檔唔會被刪除。確定移除？"
                                >
                                  <Trash2 size={12} aria-hidden="true" /> 移除
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-[var(--radius-card)] border border-dashed border-system-border bg-system-muted/35 p-6 text-center">
                      <Paperclip className="mx-auto text-system-muted-foreground" size={22} />
                      <p className="mt-2 text-xs font-semibold text-system-muted-foreground">
                        暫時未有正式交付；Brief 入面嘅解釋圖唔會喺呢度出現。
                      </p>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="grid gap-3">
                {canContribute ? (
                  <form
                    action={fixtureMode ? undefined : addCreativeCommentAction}
                    onSubmit={
                      fixtureMode ? (event) => event.preventDefault() : undefined
                    }
                    className="grid gap-2.5 rounded-[var(--radius-card)] border border-system-border bg-system-background p-3.5"
                  >
                    <input type="hidden" name="jobId" value={jobId} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <label className="grid gap-1.5 text-sm font-black">
                      留言／修改要求
                      <textarea
                        name="body"
                        rows={5}
                        className={fieldClass()}
                        placeholder="寫低問題、欠缺素材、修改內容或 Review 意見…"
                        required
                      />
                    </label>
                    <SubmitButton
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-system-primary px-3 text-xs font-black text-system-primary-foreground"
                      pendingLabel="送出中…"
                    >
                      <Send size={13} aria-hidden="true" /> 送出留言
                    </SubmitButton>
                  </form>
                ) : null}

                {comments.length ? (
                  comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="truncate text-sm">
                          {comment.authorName || comment.authorEmail || "團隊成員"}
                        </strong>
                        <small className="shrink-0 text-[11px] font-semibold text-system-muted-foreground">
                          {prettyDateTime(comment.createdAt)}
                        </small>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-system-foreground">
                        {comment.body}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[var(--radius-card)] border border-dashed border-system-border bg-system-muted/35 p-6 text-center">
                    <MessageSquareText
                      className="mx-auto text-system-muted-foreground"
                      size={22}
                    />
                    <p className="mt-2 text-xs font-semibold text-system-muted-foreground">
                      暫時未有留言或修改紀錄。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
