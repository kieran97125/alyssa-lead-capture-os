from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Dependencies: Tiptap v3 text colour uses the consolidated text-style package.
# ---------------------------------------------------------------------------
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["dependencies"]["@tiptap/extension-text-style"] = "3.30.6"
package["dependencies"] = dict(sorted(package["dependencies"].items()))
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Shared compact SystemButton for the create trigger.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/creative/CreativeJobCreateDialog.tsx",
    'import { createCreativeJobAction } from "@/app/creative-jobs/createAction";\n',
    'import { createCreativeJobAction } from "@/app/creative-jobs/createAction";\nimport { SystemButton } from "@/components/system/SystemButton";\n',
)
replace_once(
    "src/components/creative/CreativeJobCreateDialog.tsx",
    '''      <Dialog.Trigger
        data-testid="creative-job-create-trigger"
        className="command-primary-button !min-h-8 !rounded-lg !px-3 !py-1.5 !text-[10px]"
      >
        <Plus size={14} /> 新增設計 Job
      </Dialog.Trigger>''',
    '''      <Dialog.Trigger
        data-testid="creative-job-create-trigger"
        render={
          <SystemButton density="compact">
            <Plus size={14} aria-hidden="true" /> 新增設計 Job
          </SystemButton>
        }
      />''',
)


# ---------------------------------------------------------------------------
# Compact Job List remains readable: never shrink operational labels below 9px.
# ---------------------------------------------------------------------------
page_path = "src/app/creative-jobs/page.tsx"
page = read(page_path)
for old, new in [
    ('gap-x-3 gap-y-2 px-3 py-2.5 pr-11 text-[10px]', 'gap-x-3 gap-y-2 px-3 py-2 pr-11 text-[10px]'),
    ('text-[8px] font-bold leading-3 text-[#927987]', 'text-[9px] font-bold leading-4 text-[#927987]'),
    ('<span className="text-[8px] font-black text-[#806174]">{label}</span>', '<span className="text-[9px] font-black text-[#806174]">{label}</span>'),
    ('className="h-8 min-w-0 rounded-lg border border-[#dfcdc4] bg-white px-2 text-[9px] font-bold text-[#4d2d40]"', 'className="h-8 min-w-0 rounded-lg border border-[#dfcdc4] bg-white px-2 text-[11px] font-bold text-[#4d2d40]"'),
    ('className="text-[7px] font-black uppercase tracking-[0.05em] text-[#9a818d]"', 'data-testid="creative-list-meta-label"\n        className="text-[9px] font-black uppercase tracking-[0.04em] text-[#9a818d]"'),
    ('truncate text-[10px] leading-3', 'truncate text-[11px] leading-4'),
    ('className="block text-[7px] font-black uppercase tracking-[0.05em] text-[#9a818d]"', 'data-testid="creative-schedule-meta-label"\n        className="block text-[9px] font-black uppercase tracking-[0.04em] text-[#9a818d]"'),
    ('truncate text-[8px] leading-3', 'truncate text-[10px] leading-4'),
    ('px-1.5 py-0.5 text-[8px] font-black', 'px-1.5 py-0.5 text-[9px] font-black'),
    ('rounded-full px-2 py-1 text-[8px] font-black', 'rounded-full px-2 py-1 text-[9px] font-black'),
]:
    if old not in page:
        raise RuntimeError(f"{page_path}: missing density token {old!r}")
    page = page.replace(old, new)
write(page_path, page)


# ---------------------------------------------------------------------------
# Brief history becomes a same-page side sheet. Assets/comments stay in DB but
# are no longer permanent UI panels.
# ---------------------------------------------------------------------------
history_dialog = r'''"use client";

import { Dialog } from "@base-ui/react/dialog";
import { History, RotateCcw, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";
import { SystemButton } from "@/components/system/SystemButton";
import { buttonVariants } from "@/components/ui/button";
import { restoreCreativeBriefVersionAction } from "@/app/creative-jobs/versionActions";
import { cn } from "@/lib/utils";
import type { CreativeBriefVersion } from "@/lib/creative/types";

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

type CreativeBriefHistoryDialogProps = {
  jobId: string;
  returnPath: string;
  versions: CreativeBriefVersion[];
  canRestore: boolean;
  fixtureMode?: boolean;
};

export function CreativeBriefHistoryDialog({
  jobId,
  returnPath,
  versions,
  canRestore,
  fixtureMode = false,
}: CreativeBriefHistoryDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={
          <SystemButton
            density="compact"
            variant="outline"
            data-testid="creative-brief-version-trigger"
          >
            <History size={14} aria-hidden="true" />
            版本
            <span className="rounded-full bg-system-muted px-1.5 py-0.5 text-[10px] font-black text-system-muted-foreground">
              {versions.length}
            </span>
          </SystemButton>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/35 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-testid="creative-brief-version-dialog"
          className="fixed inset-y-0 right-0 z-[100] flex h-[100dvh] w-[min(410px,calc(100vw-0.75rem))] flex-col border-l border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:translate-x-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-x-4 data-[starting-style]:opacity-0"
        >
          <header className="flex items-start gap-3 border-b border-system-border px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-secondary text-system-secondary-foreground">
              <History size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-black tracking-[-0.02em]">
                Brief 版本
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-semibold leading-5 text-system-muted-foreground">
                系統自動留底；恢復舊版本前，目前內容仍會先保留。
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="關閉版本紀錄"
              title="關閉"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "shrink-0 rounded-[var(--radius-control)]"
              )}
            >
              <X size={15} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {versions.length ? (
              <div className="grid gap-2.5">
                {versions.map((version) => (
                  <article
                    key={version.id}
                    className="rounded-[var(--radius-card)] border border-system-border bg-system-background p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block text-sm">
                          Version {version.versionNo}
                        </strong>
                        <small className="mt-0.5 block truncate text-[11px] font-semibold text-system-muted-foreground">
                          {prettyDateTime(version.createdAt)} · {version.createdByEmail || "系統"}
                        </small>
                      </div>
                      {canRestore ? (
                        <form
                          action={fixtureMode ? undefined : restoreCreativeBriefVersionAction}
                          onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}
                        >
                          <input type="hidden" name="jobId" value={jobId} />
                          <input type="hidden" name="versionId" value={version.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <ConfirmSubmitButton
                            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] border border-system-border bg-system-card px-2.5 text-xs font-black text-system-primary"
                            pendingLabel="恢復中…"
                            confirmMessage={`確定恢復 Version ${version.versionNo}？目前版本仍會保留。`}
                          >
                            <RotateCcw size={13} aria-hidden="true" /> 恢復
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-dashed border-system-border bg-system-muted/40 p-6 text-center">
                <History className="mx-auto text-system-muted-foreground" size={22} />
                <p className="mt-2 text-xs font-semibold text-system-muted-foreground">
                  完成第一次自動儲存後會出現版本。
                </p>
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
'''
write("src/components/creative/CreativeBriefHistoryDialog.tsx", history_dialog)


# ---------------------------------------------------------------------------
# Creative Job Studio: controlled metadata draft, inline feedback, two-column
# layout, full-width Brief, version sheet only, and no permanent asset/chat UI.
# ---------------------------------------------------------------------------
studio_path = "src/components/creative/CreativeJobStudio.tsx"
studio = read(studio_path)
studio = studio.replace(
    '''import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";''',
    '''import { useMemo, useState } from "react";''',
)
studio = studio.replace(
    'import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";\n',
    'import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";\nimport { CreativeBriefHistoryDialog } from "@/components/creative/CreativeBriefHistoryDialog";\n',
)

old_type = 'type RightPanel = "assets" | "discussion" | "history";\n'
new_type = r'''type CreativeJobSettingsDraft = {
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
'''
if old_type not in studio:
    raise RuntimeError("CreativeJobStudio: RightPanel type anchor missing")
studio = studio.replace(old_type, new_type, 1)

# Preserve existing broad props for compatibility, while adding feedback/fixture.
studio = studio.replace(
    '  canManageSettings: boolean;\n};',
    '  canManageSettings: boolean;\n  feedback?: CreativeJobFeedback;\n  fixtureMode?: boolean;\n};',
    1,
)

state_start = studio.index('  const [brandId, setBrandId] = useState(props.job.brandId);')
state_end = studio.index('\n\n  const treatments = useMemo(', state_start)
state_block = r'''  const [draft, setDraft] = useState<CreativeJobSettingsDraft>(() =>
    createSettingsDraft(props.job)
  );
  const [fixtureFeedback, setFixtureFeedback] =
    useState<CreativeJobFeedback>(null);
  const returnPath = `/creative-jobs/${props.job.id}`;
  const feedback = fixtureFeedback ?? props.feedback ?? null;
  const fixtureMode = props.fixtureMode === true;

  function updateDraft<K extends keyof CreativeJobSettingsDraft>(
    key: K,
    value: CreativeJobSettingsDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
'''
studio = studio[:state_start] + state_block + studio[state_end:]

studio = studio.replace(
    '() => props.treatments.filter((item) => item.brandId === brandId),\n    [brandId, props.treatments]',
    '() => props.treatments.filter((item) => item.brandId === draft.brandId),\n    [draft.brandId, props.treatments]',
)
studio = studio.replace(
    '''    const currentIds = new Set([
      props.job.sourceTaxonomyId,
      props.job.usageTaxonomyId,
      props.job.mediaFormatTaxonomyId,
    ]);''',
    '''    const currentIds = new Set([
      props.job.sourceTaxonomyId,
      props.job.usageTaxonomyId,
      props.job.mediaFormatTaxonomyId,
      draft.sourceTaxonomyId,
      draft.usageTaxonomyId,
      draft.mediaFormatTaxonomyId,
    ]);''',
)
studio = studio.replace(
    '  }, [props.job, props.taxonomies]);',
    '  }, [draft.mediaFormatTaxonomyId, draft.sourceTaxonomyId, draft.usageTaxonomyId, props.job, props.taxonomies]);',
    1,
)
studio = studio.replace(
    '        (item) => item.isActive || item.id === props.job.assigneeProfileId\n      ),\n    [props.designers, props.job.assigneeProfileId]\n  );\n  const selectedDesigner = availableDesigners.find(\n    (item) => item.id === props.job.assigneeProfileId\n  );',
    '        (item) => item.isActive || item.id === draft.assigneeProfileId\n      ),\n    [draft.assigneeProfileId, props.designers]\n  );\n  const selectedDesigner = availableDesigners.find(\n    (item) => item.id === draft.assigneeProfileId\n  );',
)

# Remove now-obsolete asset upload/list callback code. Existing backend records/actions remain.
upload_start = studio.index('  async function uploadAssetFiles')
return_anchor = studio.index('\n\n  return (', upload_start)
studio = studio[:upload_start] + studio[return_anchor:]

studio = studio.replace(
    'className="sticky top-0 z-30 border-b border-[#ead9cf] bg-[#fffdfb]/95 px-4 py-3 backdrop-blur-xl sm:px-6"',
    'className="border-b border-[#ead9cf] bg-[#fffdfb] px-4 py-3 sm:px-6"',
)
studio = studio.replace(
    'placement="header"\n            />',
    'placement="header"\n              fixtureMode={fixtureMode}\n            />',
    1,
)
studio = studio.replace(
    '      <main className="mx-auto grid max-w-[1880px] gap-4 p-4 sm:p-6 xl:grid-cols-[310px_minmax(620px,1fr)_350px] xl:items-start">',
    '      <main className="mx-auto grid max-w-[1880px] gap-4 p-4 sm:p-6 xl:grid-cols-[288px_minmax(0,1fr)] xl:items-start">',
)
studio = studio.replace(
    '        <aside className="order-2 grid gap-4 xl:order-1">',
    '        <aside className="order-2 grid gap-4 xl:order-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">',
)
studio = studio.replace(
    '''          <form
            action={updateCreativeJobAction}
            className={`${sectionClass()} grid gap-0`}
          >''',
    '''          <form
            action={fixtureMode ? undefined : updateCreativeJobAction}
            onSubmit={
              fixtureMode
                ? (event) => {
                    event.preventDefault();
                    setFixtureFeedback({
                      status: "success",
                      message: "設計工作已儲存；畫面設定保持不變。",
                    });
                  }
                : undefined
            }
            data-testid="creative-job-settings-form"
            className={`${sectionClass()} grid gap-0`}
          >''',
)
studio = studio.replace(
    '''            </header>

            <details open className="group border-b border-[#eee3dd] p-4">''',
    '''            </header>

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

            <details open className="group border-b border-[#eee3dd] p-4">''',
    1,
)

# Controlled form values. This prevents unrelated RSC updates or feedback from
# replacing the user's current draft with stale defaultValue DOM state.
replacements = [
    ('defaultValue={props.job.title}\n                    className={fieldClass()}', 'value={draft.title}\n                    onChange={(event) => updateDraft("title", event.target.value)}\n                    className={fieldClass()}'),
    ('value={brandId}\n                    onChange={(event) => setBrandId(event.target.value)}', 'value={draft.brandId}\n                    onChange={(event) => {\n                      const nextBrandId = event.target.value;\n                      setDraft((current) => ({\n                        ...current,\n                        brandId: nextBrandId,\n                        treatmentId: props.treatments.some(\n                          (item) =>\n                            item.id === current.treatmentId &&\n                            item.brandId === nextBrandId\n                        )\n                          ? current.treatmentId\n                          : "",\n                      }));\n                    }}'),
    ('''defaultValue={
                      treatments.some((item) => item.id === props.job.treatmentId)
                        ? props.job.treatmentId || ""
                        : ""
                    }
                    className={fieldClass()}''', '''value={draft.treatmentId}
                    onChange={(event) =>
                      updateDraft("treatmentId", event.target.value)
                    }
                    className={fieldClass()}'''),
    ('defaultValue={props.job.assigneeProfileId || ""}\n                    className={fieldClass()}', 'value={draft.assigneeProfileId}\n                    onChange={(event) =>\n                      updateDraft("assigneeProfileId", event.target.value)\n                    }\n                    className={fieldClass()}'),
    ('''defaultValue={
                          category === "source"
                            ? props.job.sourceTaxonomyId || ""
                            : category === "usage"
                              ? props.job.usageTaxonomyId || ""
                              : props.job.mediaFormatTaxonomyId || ""
                        }
                        className={fieldClass()}''', '''value={
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
                        className={fieldClass()}'''),
    ('defaultValue={props.job.quantity}\n                      className={fieldClass()}', 'value={draft.quantity}\n                      onChange={(event) => updateDraft("quantity", event.target.value)}\n                      className={fieldClass()}'),
    ('defaultValue={props.job.workload}\n                      className={fieldClass()}', 'value={draft.workload}\n                      onChange={(event) =>\n                        updateDraft(\n                          "workload",\n                          event.target.value as CreativeJobRow["workload"]\n                        )\n                      }\n                      className={fieldClass()}'),
    ('defaultValue={props.job.specifications || ""}\n                    rows={4}', 'value={draft.specifications}\n                    onChange={(event) =>\n                      updateDraft("specifications", event.target.value)\n                    }\n                    rows={4}'),
    ('defaultValue={props.job.startDate}\n                      className={fieldClass()}', 'value={draft.startDate}\n                      onChange={(event) => updateDraft("startDate", event.target.value)}\n                      className={fieldClass()}'),
    ('defaultValue={props.job.startTime || ""}\n                      className={fieldClass()}', 'value={draft.startTime}\n                      onChange={(event) => updateDraft("startTime", event.target.value)}\n                      className={fieldClass()}'),
    ('defaultValue={props.job.dueDate || ""}\n                      className={fieldClass()}', 'value={draft.dueDate}\n                      onChange={(event) => updateDraft("dueDate", event.target.value)}\n                      className={fieldClass()}'),
    ('defaultValue={props.job.dueTime || ""}\n                      className={fieldClass()}', 'value={draft.dueTime}\n                      onChange={(event) => updateDraft("dueTime", event.target.value)}\n                      className={fieldClass()}'),
    ('defaultValue={props.job.priority}\n                    className={fieldClass()}', 'value={draft.priority}\n                    onChange={(event) =>\n                      updateDraft(\n                        "priority",\n                        event.target.value as CreativeJobRow["priority"]\n                      )\n                    }\n                    className={fieldClass()}'),
    ('defaultValue={props.job.materialStatus}\n                    className={fieldClass()}', 'value={draft.materialStatus}\n                    onChange={(event) =>\n                      updateDraft(\n                        "materialStatus",\n                        event.target.value as "ready" | "waiting"\n                      )\n                    }\n                    className={fieldClass()}'),
    ('checked={syncCalendar}\n                    onChange={(event) => setSyncCalendar(event.target.checked)}', 'checked={draft.syncCalendar}\n                    onChange={(event) =>\n                      updateDraft("syncCalendar", event.target.checked)\n                    }'),
    ('{syncCalendar ? (', '{draft.syncCalendar ? ('),
    ('''defaultValue={
                          props.job.publishDate || props.job.dueDate || ""
                        }
                        className={fieldClass()}''', '''value={draft.publishDate}
                        onChange={(event) =>
                          updateDraft("publishDate", event.target.value)
                        }
                        className={fieldClass()}'''),
    ('defaultValue={props.job.publishTime || ""}\n                        className={fieldClass()}', 'value={draft.publishTime}\n                        onChange={(event) =>\n                          updateDraft("publishTime", event.target.value)\n                        }\n                        className={fieldClass()}'),
    ('defaultValue={props.job.sourceUrl || ""}\n                    className={fieldClass()}', 'value={draft.sourceUrl}\n                    onChange={(event) => updateDraft("sourceUrl", event.target.value)}\n                    className={fieldClass()}'),
    ('defaultValue={props.job.referenceUrl || ""}\n                    className={fieldClass()}', 'value={draft.referenceUrl}\n                    onChange={(event) =>\n                      updateDraft("referenceUrl", event.target.value)\n                    }\n                    className={fieldClass()}'),
    ('defaultValue={props.job.status}\n                  className={fieldClass()}', 'value={draft.status}\n                  onChange={(event) =>\n                    updateDraft(\n                      "status",\n                      event.target.value as CreativeJobRow["status"]\n                    )\n                  }\n                  className={fieldClass()}'),
]
for old, new in replacements:
    if old not in studio:
        raise RuntimeError(f"CreativeJobStudio controlled-field anchor missing: {old[:120]!r}")
    studio = studio.replace(old, new, 1)

studio = studio.replace(
    '<details className="border-b border-[#eee3dd] p-4">\n              <summary className="cursor-pointer list-none text-xs font-black">\n                快速素材連結',
    '<details open className="border-b border-[#eee3dd] p-4">\n              <summary className="cursor-pointer list-none text-xs font-black">\n                快速素材連結',
    1,
)
studio = studio.replace(
    '<div className="grid gap-3 p-4">',
    '<div className="sticky bottom-0 z-10 grid gap-3 border-t border-[#eadfd9] bg-white/95 p-4 backdrop-blur">',
    1,
)
studio = studio.replace(
    '<form action={updateCreativeJobStatusAction} className={`${sectionClass()} p-4`}>',
    '<form\n              action={fixtureMode ? undefined : updateCreativeJobStatusAction}\n              onSubmit={fixtureMode ? (event) => event.preventDefault() : undefined}\n              className={`${sectionClass()} p-4`}\n            >',
)

# Workspace source/reference actions use current draft and gain the version sheet.
studio = studio.replace('{props.job.sourceUrl ? (', '{draft.sourceUrl ? (', 1)
studio = studio.replace('href={props.job.sourceUrl}', 'href={draft.sourceUrl}', 1)
studio = studio.replace('{props.job.referenceUrl ? (', '{draft.referenceUrl ? (', 1)
studio = studio.replace('href={props.job.referenceUrl}', 'href={draft.referenceUrl}', 1)
version_anchor = '''              {draft.referenceUrl ? (
                <a
                  href={draft.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfcdc4] bg-white px-2.5 text-[10px] font-black text-[#6d4a5c]"
                >
                  <ExternalLink size={13} /> Reference
                </a>
              ) : null}'''
if version_anchor not in studio:
    raise RuntimeError("CreativeJobStudio: workspace reference action anchor missing")
studio = studio.replace(
    version_anchor,
    version_anchor
    + '''
              <CreativeBriefHistoryDialog
                jobId={props.job.id}
                returnPath={returnPath}
                versions={props.versions}
                canRestore={props.canEditBrief}
                fixtureMode={fixtureMode}
              />''',
    1,
)
studio = studio.replace(
    '''          <CreativeBriefEditor
            ref={editorRef}
            jobId={props.job.id}
            initialDocument={props.job.briefDocument}
            editable={props.canEditBrief}
            onAssetCreated={handleBriefAssetCreated}
          />''',
    '''          <CreativeBriefEditor
            jobId={props.job.id}
            initialDocument={props.job.briefDocument}
            editable={props.canEditBrief}
            persistenceEnabled={!fixtureMode}
          />''',
)

# Remove permanent right rail from the product UI. Database rows/actions are untouched.
right_start = studio.index('        <aside className="order-3 min-w-0')
right_end_marker = '        </aside>\n      </main>'
right_end = studio.rindex(right_end_marker)
studio = studio[:right_start] + '      </main>' + studio[right_end + len(right_end_marker):]

# Creator fallback must match list semantics.
studio = studio.replace(
    '{props.job.requesterName || props.job.requesterEmail || "系統匯入"}',
    '{requesterDisplayName(props.job.requesterName, props.job.requesterEmail)}',
)

write(studio_path, studio)


# ---------------------------------------------------------------------------
# Detail page carries server action feedback and keys draft state only by Job ID.
# ---------------------------------------------------------------------------
detail_path = "src/app/creative-jobs/[jobId]/page.tsx"
detail = read(detail_path)
detail = detail.replace(
    '''export default async function CreativeJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {''',
    '''function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export default async function CreativeJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{
    creative_status?: string | string[];
    creative_message?: string | string[];
  }>;
}) {''',
)
detail = detail.replace(
    '''  const moduleAccess = await requireModuleAccess("creative_jobs");
  const { jobId } = await params;
  const detail = moduleAccess.allowed ? await getCreativeJobDetail(jobId) : null;''',
    '''  const moduleAccess = await requireModuleAccess("creative_jobs");
  const { jobId } = await params;
  const query = (await searchParams) ?? {};
  const message = firstParam(query.creative_message);
  const feedback = message
    ? {
        status: firstParam(query.creative_status) === "error"
          ? ("error" as const)
          : ("success" as const),
        message,
      }
    : null;
  const detail = moduleAccess.allowed ? await getCreativeJobDetail(jobId) : null;''',
)
detail = detail.replace(
    '''        <CreativeJobStudio
          job={detail.job}''',
    '''        <CreativeJobStudio
          key={detail.job.id}
          job={detail.job}''',
)
detail = detail.replace(
    '''          canContributeAssets={detail.canContributeAssets}
          canManageSettings={detail.canManageSettings}
        />''',
    '''          canContributeAssets={detail.canContributeAssets}
          canManageSettings={detail.canManageSettings}
          feedback={feedback}
        />''',
)
write(detail_path, detail)


# ---------------------------------------------------------------------------
# Tiptap Brief: sticky toolbar, text colour, and inline-only screenshot semantics.
# ---------------------------------------------------------------------------
editor_path = "src/components/creative/CreativeBriefEditor.tsx"
editor = read(editor_path)
editor = editor.replace(
    'import Underline from "@tiptap/extension-underline";\n',
    'import Underline from "@tiptap/extension-underline";\nimport { Color, TextStyle } from "@tiptap/extension-text-style";\n',
)
editor = editor.replace(
    '  Minus,\n  Quote,',
    '  Minus,\n  Palette,\n  Quote,\n  RotateCcw,',
)
editor = editor.replace(
    '    onAssetCreated?: (asset: CreativeAsset) => void;\n',
    '',
)
editor = editor.replace(
    '''    editable,
    onAssetCreated,
    persistenceEnabled = true,''',
    '''    editable,
    persistenceEnabled = true,''',
)
editor = editor.replace('      onAssetCreated?.(result.asset);\n', '')
editor = editor.replace('    [jobId, onAssetCreated]\n', '    [jobId]\n')
editor = editor.replace(
    '''      Underline,
      Link.configure({''',
    '''      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      Link.configure({''',
)
editor = editor.replace(
    '        <div className={styles.toolbar} role="toolbar" aria-label="Brief 編輯工具">',
    '        <div\n          className={styles.toolbar}\n          role="toolbar"\n          aria-label="Brief 編輯工具"\n          data-testid="creative-brief-toolbar"\n        >',
)

color_group_anchor = '''          <div className={styles.toolbarGroup}>
            <ToolbarButton
              label="項目列表"'''
color_group = '''          <div className={styles.toolbarGroup}>
            <label
              className={styles.colorControl}
              title="文字顏色"
              aria-label="文字顏色"
            >
              <Palette size={15} aria-hidden="true" />
              <span
                className={styles.colorSwatch}
                style={{
                  backgroundColor: /^#[0-9a-f]{6}$/i.test(
                    String(editor.getAttributes("textStyle").color || "")
                  )
                    ? String(editor.getAttributes("textStyle").color)
                    : "#321428",
                }}
                aria-hidden="true"
              />
              <input
                data-testid="brief-text-color-control"
                type="color"
                value={
                  /^#[0-9a-f]{6}$/i.test(
                    String(editor.getAttributes("textStyle").color || "")
                  )
                    ? String(editor.getAttributes("textStyle").color)
                    : "#321428"
                }
                aria-label="文字顏色"
                onChange={(event) =>
                  editor.chain().focus().setColor(event.target.value).run()
                }
              />
            </label>
            <ToolbarButton
              label="還原文字顏色"
              disabled={!editor.getAttributes("textStyle").color}
              onClick={() => editor.chain().focus().unsetColor().run()}
            >
              <RotateCcw size={15} />
            </ToolbarButton>
          </div>
'''
if color_group_anchor not in editor:
    raise RuntimeError("CreativeBriefEditor: colour insertion anchor missing")
editor = editor.replace(color_group_anchor, color_group + color_group_anchor, 1)
editor = editor.replace(
    'Marketer Brief 為唯讀；Designer 可以喺右邊素材庫交 Draft／Final，同埋留言提出問題。',
    'Marketer Brief 為唯讀；Designer 可以查看完整指示，再由工作狀態回報製作進度。',
)
editor = editor.replace(
    '可直接 Ctrl + V 貼 Screenshot，或將圖片拖入 Brief 任意位置；圖片會安全儲存到 Job 素材庫。',
    '可直接 Ctrl + V 貼 Screenshot，或將圖片拖入 Brief 任意位置；圖片只作 Brief 解釋，不會列入正式素材。',
)
write(editor_path, editor)

css_path = "src/components/creative/CreativeBriefEditor.module.css"
css = read(css_path)
css = css.replace('  overflow: hidden;\n  border: 1px solid', '  overflow: visible;\n  border: 1px solid', 1)
css = css.replace(
    '''  flex-wrap: wrap;
  align-items: center;
  gap: 6px;''',
    '''  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;''',
    1,
)
css = css.replace(
    '''  background: rgba(255, 253, 251, 0.96);
  padding: 10px 12px;
  backdrop-filter: blur(14px);''',
    '''  background: rgba(255, 253, 251, 0.97);
  padding: 8px 10px;
  box-shadow: 0 10px 24px rgba(50, 20, 40, 0.06);
  backdrop-filter: blur(14px);''',
    1,
)
css = css.replace(
    '''.toolbarGroup {
  display: inline-flex;''',
    '''.toolbarGroup {
  display: inline-flex;
  flex: 0 0 auto;''',
    1,
)
css = css.replace(
    '''.saveStatus {
  margin-left: auto;
  display: inline-flex;''',
    '''.saveStatus {
  position: sticky;
  right: 0;
  margin-left: auto;
  display: inline-flex;
  flex: 0 0 auto;''',
    1,
)
css = css.replace(
    '''  color: #806174;
  font-size: 10px;''',
    '''  border-left: 1px solid #eadfd9;
  background: rgba(255, 253, 251, 0.98);
  padding-left: 10px;
  color: #806174;
  font-size: 10px;''',
    1,
)
css = css.replace(
    '''  min-height: 0;
  overflow: auto;''',
    '''  min-height: 0;
  overflow: visible;''',
    1,
)
css = css.replace('  width: min(100%, 920px);', '  width: min(100%, 1120px);', 1)
color_css = r'''
.colorControl {
  position: relative;
  display: inline-flex;
  min-width: 42px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: #6d4a5c;
  transition: 140ms ease;
}

.colorControl:hover {
  border-color: #e5d3db;
  background: #fff4f7;
  color: #5a2348;
}

.colorControl:focus-within {
  outline: 3px solid rgba(90, 35, 72, 0.18);
  outline-offset: 1px;
}

.colorControl input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0;
}

.colorSwatch {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(50, 20, 40, 0.2);
  border-radius: 999px;
  box-shadow: 0 0 0 2px #fff;
}
'''
css = css.replace('\n.saveStatus {', color_css + '\n.saveStatus {', 1)
css = css.replace(
    '''  .toolbar {
    gap: 4px;
    padding: 8px;
  }''',
    '''  .toolbar {
    gap: 4px;
    padding: 7px 8px;
  }''',
)
css = css.replace(
    '''  .saveStatus {
    width: 100%;
    justify-content: flex-start;
    margin: 2px 0 0;
  }''',
    '''  .saveStatus {
    width: auto;
    min-width: max-content;
    justify-content: flex-start;
    margin-left: 4px;
  }''',
)
write(css_path, css)


# ---------------------------------------------------------------------------
# Fixture now mounts the real Studio so controlled draft, colour and version
# interactions are acceptance-tested, while keeping the list-only baseline.
# ---------------------------------------------------------------------------
fixture = r'''"use client";

import {
  CreativeJobCreateDialog,
} from "@/components/creative/CreativeJobCreateDialog";
import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";
import { CreativeJobStudio } from "@/components/creative/CreativeJobStudio";
import type { BrandSetting } from "@/lib/data/configuration";
import type {
  CreativeBriefVersion,
  CreativeDesignerProfile,
  CreativeJobRow,
  CreativeTaxonomyItem,
} from "@/lib/creative/types";

const sampleDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Campaign 目的" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "為 Meta AD 製作三條不同 Angle 的 KOL 短片。",
        },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "標清價錢與 CTA" }],
            },
          ],
        },
      ],
    },
    ...Array.from({ length: 18 }, (_, index) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `長篇 Brief 測試段落 ${index + 1}：畫面、字幕、Reference 同修改要求。`,
        },
      ],
    })),
  ],
};

const fixtureBrands: BrandSetting[] = [
  {
    id: "fixture-brand",
    name: "GOS",
    slug: "gos",
    primaryColor: "#d66a22",
    secondaryColor: "#fff4eb",
    whatsappNumber: null,
    defaultThankYouUrl: null,
  },
];

const fixtureDesigners: CreativeDesignerProfile[] = [
  {
    id: "fixture-designer",
    displayName: "Amber",
    linkedMemberId: null,
    linkedMemberName: null,
    linkedMemberEmail: null,
    isActive: true,
    sortOrder: 10,
  },
];

const fixtureTaxonomies: CreativeTaxonomyItem[] = [
  {
    id: "fixture-source",
    category: "source",
    name: "KOL 拍攝 Raw Footage",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "fixture-usage",
    category: "usage",
    name: "Meta AD",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "fixture-format",
    category: "media_format",
    name: "Video",
    isActive: true,
    sortOrder: 10,
  },
];

const fixtureVersions: CreativeBriefVersion[] = [
  {
    id: "fixture-version-2",
    versionNo: 2,
    reason: "manual",
    createdByEmail: "marketer@example.test",
    createdAt: "2026-09-03T05:00:00.000Z",
  },
  {
    id: "fixture-version-1",
    versionNo: 1,
    reason: "autosave",
    createdByEmail: "marketer@example.test",
    createdAt: "2026-09-03T04:00:00.000Z",
  },
];

const fixtureJob: CreativeJobRow = {
  id: "fixture-job",
  brandId: "fixture-brand",
  brandName: "GOS Beauty",
  treatmentId: null,
  treatmentLabel: null,
  title: "GOS KOL 脫毛廣告片",
  status: "in_progress",
  priority: "priority",
  workload: "M",
  startDate: "2026-09-01",
  startTime: null,
  dueDate: "2026-09-04",
  dueTime: null,
  publishDate: "2026-09-06",
  publishTime: null,
  syncCalendar: true,
  calendarItemId: "fixture-calendar",
  sourceTaxonomyId: "fixture-source",
  sourceName: "KOL 拍攝 Raw Footage",
  usageTaxonomyId: "fixture-usage",
  usageName: "Meta AD",
  mediaFormatTaxonomyId: "fixture-format",
  mediaFormatName: "Video",
  assigneeProfileId: "fixture-designer",
  assigneeProfileName: "Amber",
  assigneeMemberId: null,
  assigneeEmail: null,
  requesterMemberId: "fixture-requester",
  requesterName: "Kieran Kwok",
  requesterEmail: "kieran@example.test",
  materialStatus: "ready",
  quantity: 3,
  specifications: "9:16 × 3；每條 20–30 秒；有字幕。",
  sourceUrl: "https://drive.google.com/example-source",
  referenceUrl: "https://example.test/reference",
  briefDocument: sampleDocument,
  briefPlainText: "Campaign 目的",
  revisionCount: 0,
  completedAt: null,
  createdAt: "2026-09-01T01:00:00.000Z",
  updatedAt: "2026-09-03T05:00:00.000Z",
};

export function CreativeProductionFixture() {
  return (
    <main className="min-h-screen bg-[#fbf7f5] p-4 text-[#321428] sm:p-8">
      <section className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d76]">
              Creative production fixture
            </p>
            <h1 className="mt-1 text-3xl font-black">設計工作</h1>
          </div>
          <div className="flex items-center gap-2">
            <CreativeJobDeleteControl
              jobId="fixture-job"
              title="GOS KOL 脫毛廣告片"
              placement="header"
              fixtureMode
            />
            <CreativeJobCreateDialog
              brands={fixtureBrands}
              designers={fixtureDesigners}
              taxonomies={fixtureTaxonomies}
              defaultBrandId="fixture-brand"
              today="2026-09-01"
              fixtureMode
            />
          </div>
        </header>

        <section
          className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-[#e8dcd5] bg-white"
          data-testid="creative-job-list-fixture"
        >
          <div className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] gap-3 border-b border-[#eadfd9] bg-[#fbf9f7] px-3 py-2 text-[9px] font-black xl:grid">
            <span>Job</span>
            <span>負責</span>
            <span>製作規格</span>
            <span>時間</span>
            <span>狀態</span>
          </div>
          <div className="relative">
            <div
              data-testid="creative-job-row"
              className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 px-3 py-2 pr-11 text-[10px] font-semibold md:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.82fr)_minmax(220px,1.1fr)_minmax(205px,1fr)_minmax(86px,0.4fr)] xl:items-center"
            >
              <div className="min-w-0">
                <strong className="block truncate text-[12px] leading-4">
                  GOS KOL 脫毛廣告片
                </strong>
                <span className="mt-1 flex flex-wrap gap-x-2 text-[9px] leading-4 text-[#927987]">
                  <span>3 件 · M</span>
                  <span>建立者：Kieran Kwok</span>
                </span>
              </div>
              <div className="grid gap-1 text-[11px] leading-4">
                <span>
                  <small data-testid="creative-list-meta-label" className="mr-2 text-[9px] text-[#927987]">品牌</small>
                  GOS
                </span>
                <span>
                  <small className="mr-2 text-[9px] text-[#927987]">Designer</small>
                  Amber
                </span>
              </div>
              <div className="grid min-w-0 gap-1 text-[11px] leading-4">
                <span className="truncate"><small className="mr-2 text-[9px] text-[#927987]">Source</small>KOL 拍攝 Raw Footage</span>
                <span><small className="mr-2 text-[9px] text-[#927987]">用途</small>Meta AD</span>
                <span><small className="mr-2 text-[9px] text-[#927987]">媒體格式</small>Video</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <span className="rounded-lg bg-[#f8f4f2] px-2 py-1.5"><small className="block text-[9px] text-[#927987]">Start</small>1/9</span>
                <span className="rounded-lg bg-[#f8f4f2] px-2 py-1.5"><small className="block text-[9px] text-[#927987]">Due</small>4/9</span>
                <span className="rounded-lg bg-[#f8f4f2] px-2 py-1.5"><small className="block text-[9px] text-[#927987]">Publish</small>6/9</span>
              </div>
              <span className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[9px] font-black">
                製作中
              </span>
            </div>
            <div className="absolute right-2 top-2 xl:top-1/2 xl:-translate-y-1/2">
              <CreativeJobDeleteControl
                jobId="fixture-job"
                title="GOS KOL 脫毛廣告片"
                returnPath="/creative-jobs?brand=fixture-brand&view=review"
                placement="list"
                fixtureMode
              />
            </div>
          </div>
        </section>

        <section className="mt-8" data-testid="creative-rich-brief-fixture">
          <CreativeJobStudio
            job={fixtureJob}
            assets={[]}
            comments={[]}
            versions={fixtureVersions}
            notifications={[]}
            brands={fixtureBrands}
            treatments={[]}
            taxonomies={fixtureTaxonomies}
            designers={fixtureDesigners}
            canEditMetadata
            canEditBrief
            canUpdateStatus
            canContributeAssets
            canManageSettings
            fixtureMode
          />
        </section>
      </section>
    </main>
  );
}
'''
write("src/components/creative/CreativeProductionFixture.tsx", fixture)


# ---------------------------------------------------------------------------
# Acceptance tests for persistence, colour, sticky toolbar and version-only IA.
# ---------------------------------------------------------------------------
e2e_path = "e2e/creative-production.spec.ts"
e2e = read(e2e_path)
e2e = e2e.replace('expect(rowBox?.height ?? 999).toBeLessThanOrEqual(86);', 'expect(rowBox?.height ?? 999).toBeLessThanOrEqual(90);')
e2e = e2e.replace(
    '''  const createBox = await page.getByTestId("creative-job-create-trigger").boundingBox();''',
    '''  const labelFontSize = await list
    .getByTestId("creative-list-meta-label")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(labelFontSize).toBeGreaterThanOrEqual(9);

  const createBox = await page.getByTestId("creative-job-create-trigger").boundingBox();''',
)
new_tests = r'''

test("Job setting draft stays stable through Brief interaction and save feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  const form = page.getByTestId("creative-job-settings-form");
  const title = form.getByLabel("Job 名稱");
  await title.fill("GOS Inbox 好評合集｜新版設定");
  await form.getByLabel("優先處理").selectOption("urgent");

  const workspace = page.getByTestId("creative-brief-workspace");
  await workspace.getByRole("button", { name: "粗體" }).click();
  await expect(title).toHaveValue("GOS Inbox 好評合集｜新版設定");
  await expect(form.getByLabel("優先處理")).toHaveValue("urgent");

  await form.getByRole("button", { name: "儲存 Job 設定" }).click();
  await expect(form.getByTestId("creative-job-settings-feedback")).toContainText(
    "畫面設定保持不變"
  );
  await expect(title).toHaveValue("GOS Inbox 好評合集｜新版設定");
  await expect(form.getByLabel("優先處理")).toHaveValue("urgent");
});

test("Brief workspace offers text colour, sticky tools and version-only side sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 560 });
  await openFixture(page);
  const studio = page.getByTestId("creative-rich-brief-fixture");
  const workspace = studio.getByTestId("creative-brief-workspace");
  const toolbar = workspace.getByTestId("creative-brief-toolbar");

  await expect(workspace.getByLabel("文字顏色")).toBeVisible();
  await expect(workspace.getByRole("button", { name: "還原文字顏色" })).toBeVisible();
  await workspace.getByTestId("brief-text-color-control").fill("#a43b50");
  await expect(workspace.getByTestId("brief-text-color-control")).toHaveValue("#a43b50");

  const position = await toolbar.evaluate((element) => getComputedStyle(element).position);
  expect(position).toBe("sticky");
  await toolbar.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 500));
  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox?.y ?? 999).toBeLessThanOrEqual(2);

  await expect(studio.getByText("Job 素材庫", { exact: true })).toHaveCount(0);
  await expect(studio.getByText("留言／修改要求", { exact: true })).toHaveCount(0);
  await expect(workspace).toContainText("不會列入正式素材");

  await studio.getByTestId("creative-brief-version-trigger").click();
  const dialog = page.getByTestId("creative-brief-version-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Version 2");
  await dialog.getByRole("button", { name: "關閉版本紀錄" }).click();
  await expect(dialog).toBeHidden();
});
'''
insert_at = e2e.index('\ntest("creative workspace remains usable on mobile')
e2e = e2e[:insert_at] + new_tests + e2e[insert_at:]
write(e2e_path, e2e)


# ---------------------------------------------------------------------------
# Contract checks: protect the requested architecture from regression.
# ---------------------------------------------------------------------------
contract_path = "scripts/verify-creative-production-contract.mjs"
contract = read(contract_path)
contract = contract.replace(
    'const deleteControl = read("src/components/creative/CreativeJobDeleteControl.tsx");\n',
    'const deleteControl = read("src/components/creative/CreativeJobDeleteControl.tsx");\nconst historyDialog = read("src/components/creative/CreativeBriefHistoryDialog.tsx");\nconst editorStyles = read("src/components/creative/CreativeBriefEditor.module.css");\nconst detailPage = read("src/app/creative-jobs/[jobId]/page.tsx");\n',
)
contract = contract.replace(
    'assert.match(editor, /@tiptap\\/react/);',
    'assert.match(editor, /@tiptap\\/react/);\nassert.match(editor, /@tiptap\\/extension-text-style/);\nassert.match(editor, /Color, TextStyle/);\nassert.match(editor, /setColor/);\nassert.match(editor, /unsetColor/);\nassert.doesNotMatch(editor, /onAssetCreated/);\nassert.match(editor, /不會列入正式素材/);\nassert.match(editor, /creative-brief-toolbar/);\nassert.match(editorStyles, /position: sticky/);\nassert.match(editorStyles, /overflow: visible/);',
)
contract = contract.replace(
    'assert.match(studio, /CreativeJobDeleteControl/);',
    'assert.match(studio, /CreativeJobDeleteControl/);\nassert.match(studio, /CreativeBriefHistoryDialog/);\nassert.match(studio, /creative-job-settings-form/);\nassert.match(studio, /value=\\{draft\\.title\\}/);\nassert.match(studio, /creative-job-settings-feedback/);\nassert.doesNotMatch(studio, /type RightPanel/);\nassert.doesNotMatch(studio, /Job 素材庫/);\nassert.doesNotMatch(studio, /留言／修改要求/);\nassert.match(historyDialog, /SystemButton/);\nassert.match(historyDialog, /creative-brief-version-dialog/);\nassert.match(detailPage, /key=\\{detail\\.job\\.id\\}/);\nassert.match(detailPage, /creative_message/);',
)
contract = contract.replace(
    'assert.match(createDialog, /@\\/lib\\/creative\\/createState/);',
    'assert.match(createDialog, /@\\/lib\\/creative\\/createState/);\nassert.match(createDialog, /SystemButton/);',
)
contract = contract.replace(
    '  "@tiptap/extension-underline",',
    '  "@tiptap/extension-underline",\n  "@tiptap/extension-text-style",',
)
write(contract_path, contract)


# ---------------------------------------------------------------------------
# Product/design records. Canonical private export is completed after the final
# implementation commit exists, so this local record already carries PR evidence
# and explicit isolation/rollback requirements.
# ---------------------------------------------------------------------------
learning_path = "docs/product-learning/entries/2026-09-03-creative-job-density-requester-provenance.md"
learning = r'''# Creative Job operational density, requester provenance and Brief workspace

## Problem

The first Creative Production release used generous display sizing and a permanent three-tab right rail. With real work imported, the Job List became visually heavy, creator ownership was hidden, metadata edits could appear to revert after a server validation/navigation, and explanatory Brief screenshots were mixed into the same visible area as production assets. Long Briefs also forced users to scroll back to formatting controls.

## Decision

Creative Job rows use a compact but readable hierarchy: title/priority, persisted creator provenance, brand/designer, production taxonomy, schedule and status. Creator and assigned Designer remain separate concepts. Operational labels stay at or above the approved readable scale; density comes from spacing, grouping and control height rather than microscopic text.

Job settings use a controlled client draft keyed only by Job ID. Server success/error feedback appears inside the settings panel, and unrelated Brief interaction cannot replace the current draft with stale `defaultValue` state. A hard reload still projects canonical database values.

The Brief workspace is the primary production surface. It reclaims the former right rail, keeps a bounded readable canvas, exposes a sticky formatting toolbar, and adds Tiptap text colour through the existing open-source text-style extension. Pasted/dropped screenshots remain private inline Brief attachments and are not presented as production materials. Version history is available through a compact same-page side sheet; asset/comment records and backend actions remain intact but are not permanent workspace panels.

## Guardrails

- Creator means the persisted requester, never the current Designer.
- Member display name is preferred; email local part and `system import` are transparent fallbacks.
- Controlled form state is scoped to one Job ID and must not hide server validation feedback.
- Database values remain the source of truth after reload.
- Inline Brief images stay private and retrievable, but are not classified as production assets.
- Removing asset/discussion panels is an information-architecture change, not data deletion.
- Sticky controls must not introduce horizontal page overflow or unbounded line length.
- Existing permissions, calendar sync, notifications, audit, versions, assets and comments remain intact.
- No Lead, Book, Show, Spend, CRM, attribution or reporting logic changes.

## Classification

- **Core**: creator/assignee separation; stable controlled settings draft; inline-explanation versus production-asset separation; version history as an on-demand surface; readable operational density.
- **Configurable**: exact density tokens, responsive breakpoints, colour palette defaults, editor canvas width and labels.
- **Enterprise Extension**: role/brand permissions, audit, private attachment delivery, calendar synchronization and desktop notifications.
- **Client-specific and isolated**: brand names, team member identities, campaign terminology, visual brand colours, real URLs and production Job content must never be copied into Growth OS Core or the canonical learning record.

## Evidence

- Source PR: `kieran97125/alyssa-lead-capture-os#83`.
- Initial compact-list implementation commit: `b08afe214cb1e11e68baf7ae5594581c1d2d1e37`.
- Final implementation, test and Production evidence are appended to PR #83 and the canonical private learning record after merge.

## Verification

- Production build and TypeScript contracts.
- Tiptap text-colour and sticky-toolbar acceptance.
- Controlled Job settings persistence and inline feedback acceptance.
- Version side-sheet and removal of permanent asset/discussion panels.
- Creator provenance and minimum readable metadata sizing.
- Compact desktop list visual baseline, no horizontal scrolling and mobile acceptance.
- Design/accessibility suite and full product regression.

## Rollback

Revert PR #83. No migration is required. Stored Jobs, settings, Brief documents, inline images, versions, production asset records, comments, notifications, requester identity and audit history remain unchanged.
'''
write(learning_path, learning)

changelog_path = "docs/design-system/CHANGELOG.md"
changelog = read(changelog_path)
changelog += r'''

## 2026-09-03 — Creative Job operational workspace refinement

- Rebalanced Creative Job density with readable metadata, shared compact controls and explicit creator provenance.
- Converted Job settings to a stable controlled draft with visible server feedback.
- Expanded the Brief into the reclaimed workspace width, added sticky Tiptap text-colour controls, and separated explanatory screenshots from production-material UI.
- Replaced the permanent asset/discussion rail with an on-demand version-history side sheet while preserving all underlying records and actions.
- Rollback: revert PR #83; no database migration or historical data rewrite is required.
'''
write(changelog_path, changelog)

print("Applied final Creative Job workspace, persistence, colour, version and density changes.")
