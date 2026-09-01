from pathlib import Path
from textwrap import dedent
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


SYSTEM_CONFIRMATION_DIALOG = dedent(
    '''
    "use client";

    import type { ReactNode } from "react";
    import { Dialog } from "@base-ui/react/dialog";
    import { AlertTriangle, X } from "lucide-react";
    import { buttonVariants } from "@/components/ui/button";
    import { cn } from "@/lib/utils";

    type TriggerVariant =
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "destructive"
      | "link";

    type TriggerSize =
      | "default"
      | "xs"
      | "sm"
      | "lg"
      | "icon"
      | "icon-xs"
      | "icon-sm"
      | "icon-lg";

    type SystemConfirmationDialogProps = {
      triggerLabel: string;
      triggerIcon?: ReactNode;
      triggerVariant?: TriggerVariant;
      triggerSize?: TriggerSize;
      triggerClassName?: string;
      triggerAriaLabel?: string;
      triggerTitle?: string;
      triggerTestId?: string;
      iconOnly?: boolean;
      title: string;
      description: ReactNode;
      confirmControl: ReactNode;
      cancelLabel?: string;
      defaultOpen?: boolean;
      popupTestId?: string;
    };

    export function SystemConfirmationDialog({
      triggerLabel,
      triggerIcon,
      triggerVariant = "outline",
      triggerSize = "lg",
      triggerClassName,
      triggerAriaLabel,
      triggerTitle,
      triggerTestId,
      iconOnly = false,
      title,
      description,
      confirmControl,
      cancelLabel = "取消",
      defaultOpen = false,
      popupTestId,
    }: SystemConfirmationDialogProps) {
      return (
        <Dialog.Root defaultOpen={defaultOpen}>
          <Dialog.Trigger
            data-testid={triggerTestId}
            aria-label={triggerAriaLabel}
            title={triggerTitle}
            className={cn(
              buttonVariants({
                variant: triggerVariant,
                size: triggerSize,
              }),
              "rounded-[var(--radius-control)]",
              triggerClassName
            )}
          >
            {triggerIcon}
            {iconOnly ? (
              <span className="sr-only">{triggerLabel}</span>
            ) : (
              triggerLabel
            )}
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-[90] bg-system-foreground/45 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <Dialog.Popup
              data-testid={popupTestId}
              className="fixed left-1/2 top-1/2 z-[100] w-[min(31rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius-panel)] border border-system-border bg-system-card text-system-card-foreground shadow-[var(--shadow-overlay)] outline-none transition data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0"
            >
              <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-system-destructive/10 text-system-destructive">
                  <AlertTriangle size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-lg font-black tracking-[-0.025em]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm font-semibold leading-6 text-system-muted-foreground">
                    {description}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label="關閉確認視窗"
                  title="關閉"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "shrink-0 rounded-[var(--radius-control)]"
                  )}
                >
                  <X size={17} aria-hidden="true" />
                </Dialog.Close>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-system-border bg-system-muted/50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Dialog.Close
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "rounded-[var(--radius-control)]"
                  )}
                >
                  {cancelLabel}
                </Dialog.Close>
                {confirmControl}
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }
    '''
).lstrip()


SYSTEM_CONFIRMATION_STORY = dedent(
    '''
    import type { Meta, StoryObj } from "@storybook/nextjs-vite";
    import { Trash2 } from "lucide-react";
    import { SystemButton } from "@/components/system/SystemButton";
    import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";

    function ConfirmationSpecimen({
      defaultOpen = false,
      iconOnly = false,
    }: {
      defaultOpen?: boolean;
      iconOnly?: boolean;
    }) {
      return (
        <SystemConfirmationDialog
          defaultOpen={defaultOpen}
          triggerLabel="刪除 Job"
          triggerIcon={<Trash2 aria-hidden="true" />}
          triggerVariant="destructive"
          triggerSize={iconOnly ? "icon-lg" : "lg"}
          triggerAriaLabel={iconOnly ? "刪除 GOS KOL 脫毛廣告片" : undefined}
          iconOnly={iconOnly}
          title="刪除「GOS KOL 脫毛廣告片」？"
          description="呢張 Job 會即時由 Job List 移除，未來提醒會停止；系統 Audit 仍會保留操作記錄，方便追溯。"
          popupTestId="storybook-confirmation-dialog"
          confirmControl={
            <SystemButton variant="destructive" density="default">
              <Trash2 aria-hidden="true" />
              確認刪除
            </SystemButton>
          }
        />
      );
    }

    const meta = {
      title: "System/Overlays/SystemConfirmationDialog",
      component: ConfirmationSpecimen,
      parameters: { layout: "centered" },
      tags: ["autodocs"],
    } satisfies Meta<typeof ConfirmationSpecimen>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const ClosedDanger: Story = {};

    export const IconTrigger: Story = {
      args: { iconOnly: true },
    };

    export const OpenDanger: Story = {
      args: { defaultOpen: true },
    };
    '''
).lstrip()


CREATIVE_DELETE_CONTROL = dedent(
    '''
    "use client";

    import { Trash2 } from "lucide-react";
    import { deleteCreativeJobAction } from "@/app/creative-jobs/actions";
    import { SubmitButton } from "@/components/alyssa/SubmitButton";
    import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";
    import { buttonVariants } from "@/components/ui/button";
    import { cn } from "@/lib/utils";

    type CreativeJobDeleteControlProps = {
      jobId: string;
      title: string;
      returnPath?: string;
      placement?: "list" | "header";
      fixtureMode?: boolean;
    };

    export function CreativeJobDeleteControl({
      jobId,
      title,
      returnPath = "/creative-jobs",
      placement = "header",
      fixtureMode = false,
    }: CreativeJobDeleteControlProps) {
      const listPlacement = placement === "list";

      return (
        <SystemConfirmationDialog
          triggerLabel="刪除 Job"
          triggerIcon={<Trash2 size={listPlacement ? 14 : 15} aria-hidden="true" />}
          triggerVariant="destructive"
          triggerSize={listPlacement ? "icon-lg" : "lg"}
          triggerClassName={listPlacement ? "shadow-[var(--shadow-control)]" : undefined}
          triggerAriaLabel={listPlacement ? `刪除 ${title}` : undefined}
          triggerTitle={listPlacement ? `刪除 ${title}` : undefined}
          triggerTestId={
            listPlacement
              ? "creative-job-list-delete-button"
              : "creative-job-delete-button"
          }
          iconOnly={listPlacement}
          title={`刪除「${title}」？`}
          description="呢張 Job 會即時由 Job List 移除，未來提醒會停止；系統 Audit 仍會保留操作記錄，方便追溯。"
          popupTestId="creative-job-delete-confirmation"
          confirmControl={
            <form
              action={fixtureMode ? undefined : deleteCreativeJobAction}
              onSubmit={
                fixtureMode ? (event) => event.preventDefault() : undefined
              }
            >
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <SubmitButton
                className={cn(
                  buttonVariants({ variant: "destructive", size: "lg" }),
                  "min-w-32 rounded-[var(--radius-control)]"
                )}
                pendingLabel="刪除中…"
              >
                <Trash2 size={15} aria-hidden="true" />
                確認刪除
              </SubmitButton>
            </form>
          }
        />
      );
    }
    '''
).lstrip()


ADR = dedent(
    '''
    # ADR-002 — App-owned confirmation for destructive actions

    Date: 2026-09-01
    Status: Accepted
    Source: PR #79

    ## Context

    Creative Job deletion is a high-impact interaction. The first implementation exposed a delete icon but delegated confirmation to `window.confirm`, which cannot be visually governed, reliably screenshotted, or reviewed as part of the Alyssa design system. It also left the confirmation experience inconsistent across desktop, mobile and future destructive workflows.

    ## Decision

    1. Introduce `SystemConfirmationDialog` under `src/components/system` using the existing Base UI Dialog primitive and approved System button variants.
    2. Keep business-specific wording and server actions in `CreativeJobDeleteControl`; the shared component owns focus, overlay, hierarchy, cancel behavior and responsive layout only.
    3. Require an explicit second action labelled `確認刪除` before the server action runs.
    4. Keep deletion permission-gated and soft-delete the Job so operational Audit evidence remains available.
    5. Preserve the active Job List query after deletion by passing a validated internal `returnPath`.
    6. Protect the closed and open states with Storybook plus deterministic desktop and mobile Playwright screenshots.

    ## Consequences

    - Destructive confirmations are now app-owned, keyboard accessible and visually reviewable.
    - Feature code cannot silently replace the confirmation hierarchy with browser-native prompts.
    - The same System dialog may be reused by future destructive actions, while product wording and authorization stay feature-specific.
    - No database migration or existing production row is changed.
    '''
).lstrip()


ROLLBACK = dedent(
    '''
    # Creative Job deletion confirmation rollback map

    Date: 2026-09-01
    Source: PR #79

    ## Rollback unit

    Revert the PR #79 merge commit. This is a code-only rollback; do not alter `creative_jobs`, Audit rows or Calendar data manually.

    ## Files introduced

    - `src/components/system/SystemConfirmationDialog.tsx`
    - `src/components/system/SystemConfirmationDialog.stories.tsx`
    - `src/components/creative/CreativeJobDeleteControl.tsx`
    - desktop and mobile snapshots under `e2e/creative-production.spec.ts-snapshots/`
    - `docs/design-system/decisions/ADR-002-system-confirmation-dialog.md`

    ## Existing files modified

    - `src/app/creative-jobs/page.tsx`
    - `src/components/creative/CreativeJobStudio.tsx`
    - `src/components/creative/CreativeProductionFixture.tsx`
    - `src/app/creative-jobs/actions.ts`
    - Creative and Design System contracts, tests and change log

    ## Data and runtime risk

    Deletion remains a soft delete through `creative_jobs.deleted_at`; the change does not add or alter database schema. Reverting the UI does not restore Jobs already deleted by an authorized user. Their Audit records remain available for investigation.

    ## Verification after rollback

    1. `npm ci`
    2. `npm run build`
    3. `npm run build:storybook`
    4. `npm run test:design`
    5. `npm run test:creative`
    6. Confirm Production points to the rollback commit and no new runtime errors appear.
    '''
).lstrip()


write("src/components/system/SystemConfirmationDialog.tsx", SYSTEM_CONFIRMATION_DIALOG)
write(
    "src/components/system/SystemConfirmationDialog.stories.tsx",
    SYSTEM_CONFIRMATION_STORY,
)
write(
    "src/components/creative/CreativeJobDeleteControl.tsx",
    CREATIVE_DELETE_CONTROL,
)
write(
    "docs/design-system/decisions/ADR-002-system-confirmation-dialog.md",
    ADR,
)
write(
    "docs/design-system/rollback/2026-09-01-creative-job-delete-confirmation.md",
    ROLLBACK,
)


# Preserve active Job List filters and use the shared app-owned confirmation.
page_path = "src/app/creative-jobs/page.tsx"
page = read(page_path)
page = replace_once(page, "  Trash2,\n", "", "remove list Trash import")
page = replace_once(
    page,
    'import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";\n',
    "",
    "remove list native confirmation import",
)
page = replace_once(
    page,
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\nimport { deleteCreativeJobAction } from "@/app/creative-jobs/actions";\n',
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\nimport { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";\n',
    "list delete control import",
)
page = replace_once(
    page,
    "  if (filters.designerId) currentParams.designer = filters.designerId;\n  const message = firstParam(query.creative_message);",
    "  if (filters.designerId) currentParams.designer = filters.designerId;\n  const listReturnPath = viewHref(currentParams, filters.view);\n  const message = firstParam(query.creative_message);",
    "filtered list return path",
)
page = replace_once(
    page,
    '<div key={job.id} className="relative">',
    '<div\n                          key={job.id}\n                          className="relative border-b border-[#f0e7e2] last:border-b-0"\n                        >',
    "list row boundary",
)
page = replace_once(
    page,
    '''                          <Link
                            href={`/creative-jobs/${job.id}`}
                          className="grid min-w-0 grid-cols-1 gap-4 border-b border-[#f0e7e2] px-4 py-4 pr-14 text-[11px] font-semibold transition last:border-b-0 hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center"
                        >''',
    '''                          <Link
                            href={`/creative-jobs/${job.id}`}
                            className="grid min-w-0 grid-cols-1 gap-4 px-4 py-4 pr-14 text-[11px] font-semibold transition hover:bg-[#fff9fb] md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center"
                          >''',
    "clean list link layout",
)
old_list_delete = '''                          {snapshot.canCreate ? (
                            <form
                              action={deleteCreativeJobAction}
                              className="absolute right-3 top-3 xl:top-1/2 xl:-translate-y-1/2"
                            >
                              <input type="hidden" name="jobId" value={job.id} />
                              <ConfirmSubmitButton
                                data-testid="creative-job-list-delete-button"
                                aria-label={`刪除 ${job.title}`}
                                title={`刪除 ${job.title}`}
                                className="h-9 w-9 rounded-xl border border-[#e5c5c8] bg-white p-0 text-[#a43b50] shadow-sm transition hover:border-[#d59aa2] hover:bg-[#fff4f4]"
                                pendingLabel="…"
                                confirmMessage={`確定刪除「${job.title}」？刪除後會即時由 Job List 消失；系統 Audit 仍會保留記錄。`}
                              >
                                <Trash2 size={14} />
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}'''
new_list_delete = '''                          {snapshot.canCreate ? (
                            <div className="absolute right-3 top-3 xl:top-1/2 xl:-translate-y-1/2">
                              <CreativeJobDeleteControl
                                jobId={job.id}
                                title={job.title}
                                returnPath={listReturnPath}
                                placement="list"
                              />
                            </div>
                          ) : null}'''
page = replace_once(
    page,
    old_list_delete,
    new_list_delete,
    "replace list delete confirmation",
)
write(page_path, page)


# Move detail deletion to the shared confirmation component.
studio_path = "src/components/creative/CreativeJobStudio.tsx"
studio = read(studio_path)
studio = replace_once(
    studio,
    'import { ConfirmSubmitButton } from "@/components/alyssa/ConfirmSubmitButton";\n',
    "",
    "remove detail native confirmation import",
)
studio = replace_once(
    studio,
    '''} from "@/components/creative/CreativeBriefEditor";
import {
''',
    '''} from "@/components/creative/CreativeBriefEditor";
import { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";
import {
''',
    "detail delete control import",
)
studio = replace_once(
    studio,
    "  deleteCreativeJobAction,\n",
    "",
    "remove detail direct delete action import",
)
old_header_delete = '''          {props.canEditMetadata ? (
            <form action={deleteCreativeJobAction}>
              <input type="hidden" name="jobId" value={props.job.id} />
              <ConfirmSubmitButton
                data-testid="creative-job-delete-button"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5c5c8] bg-white px-3 text-xs font-black text-[#a43b50] transition hover:border-[#d59aa2] hover:bg-[#fff4f4]"
                pendingLabel="刪除中…"
                confirmMessage={`確定刪除「${props.job.title}」？刪除後會即時由 Job List 消失；系統 Audit 仍會保留記錄。`}
              >
                <Trash2 size={15} /> 刪除 Job
              </ConfirmSubmitButton>
            </form>
          ) : null}'''
new_header_delete = '''          {props.canEditMetadata ? (
            <CreativeJobDeleteControl
              jobId={props.job.id}
              title={props.job.title}
              placement="header"
            />
          ) : null}'''
studio = replace_once(
    studio,
    old_header_delete,
    new_header_delete,
    "replace detail delete confirmation",
)
write(studio_path, studio)


# Keep list scope after deletion; detail deletion safely falls back to Job List.
actions_path = "src/app/creative-jobs/actions.ts"
actions = read(actions_path)
delete_pattern = re.compile(
    r'''export async function deleteCreativeJobAction\(formData: FormData\) \{[\s\S]*?\n\}\n\nasync function requireCreativeSettings'''
)
new_delete_action = dedent(
    '''
    export async function deleteCreativeJobAction(formData: FormData) {
      const access = await requireCreativeAction();
      const jobId = readString(formData, "jobId");
      const requestedReturnPath = safeCreativePath(
        readString(formData, "returnPath"),
        "/creative-jobs"
      );
      const returnPath = requestedReturnPath.startsWith(`/creative-jobs/${jobId}`)
        ? "/creative-jobs"
        : requestedReturnPath;
      const record = await getCreativeJobAccessRecord(jobId);
      if (
        !record.job ||
        !canEditCreativeJobMetadata(access, {
          brandId: String(record.job.brand_id),
          assigneeMemberId:
            typeof record.job.assignee_member_id === "string"
              ? record.job.assignee_member_id
              : null,
        })
      ) {
        redirectWithMessage(returnPath, false, "你未獲授權刪除呢張工作。" );
      }
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase
        .from("creative_jobs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", jobId);
      if (error) {
        redirectWithMessage(returnPath, false, "未能刪除設計工作。" );
      }
      await writeCreativeAudit({
        jobId,
        access,
        action: "creative_job.deleted",
        before: { title: record.job.title, status: record.job.status },
      });
      revalidateCreative(jobId);
      redirectWithMessage(
        returnPath,
        true,
        "設計工作已從 Job List 刪除；系統 Audit 記錄仍然保留。"
      );
    }

    async function requireCreativeSettings'''
).lstrip()
actions, count = delete_pattern.subn(lambda _match: new_delete_action, actions, count=1)
if count != 1:
    raise SystemExit("Missing patch marker: delete action replacement")
write(actions_path, actions)


# Render both production placements in the deterministic fixture.
fixture_path = "src/components/creative/CreativeProductionFixture.tsx"
fixture = read(fixture_path)
fixture = replace_once(
    fixture,
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\n',
    'import { CreativeJobCreateDialog } from "@/components/creative/CreativeJobCreateDialog";\nimport { CreativeJobDeleteControl } from "@/components/creative/CreativeJobDeleteControl";\n',
    "fixture delete control import",
)
old_header_fixture = '''          <CreativeJobCreateDialog
            brands={fixtureBrands}
            designers={fixtureDesigners}
            taxonomies={fixtureTaxonomies}
            defaultBrandId="fixture-brand"
            today="2026-09-01"
            fixtureMode
          />'''
new_header_fixture = '''          <div className="flex items-center gap-2">
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
          </div>'''
fixture = replace_once(
    fixture,
    old_header_fixture,
    new_header_fixture,
    "fixture header delete placement",
)
fixture = replace_once(
    fixture,
    '''          <div className="grid min-w-0 grid-cols-1 gap-4 px-4 py-4 text-[11px] font-semibold md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center">''',
    '''          <div className="relative">
            <div className="grid min-w-0 grid-cols-1 gap-4 px-4 py-4 pr-14 text-[11px] font-semibold md:grid-cols-2 xl:grid-cols-[minmax(240px,1.45fr)_minmax(150px,0.85fr)_minmax(260px,1.35fr)_minmax(240px,1.2fr)_minmax(110px,0.55fr)] xl:items-center">''',
    "fixture list row wrapper",
)
fixture = replace_once(
    fixture,
    '''            <span className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[9px] font-black">
              製作中
            </span>
          </div>
        </section>''',
    '''              <span className="w-fit rounded-full bg-[#f5f1ef] px-2 py-1 text-[9px] font-black">
                製作中
              </span>
            </div>
            <div className="absolute right-3 top-3 xl:top-1/2 xl:-translate-y-1/2">
              <CreativeJobDeleteControl
                jobId="fixture-job"
                title="GOS KOL 脫毛廣告片"
                returnPath="/creative-jobs?brand=fixture-brand&view=review"
                placement="list"
                fixtureMode
              />
            </div>
          </div>
        </section>''',
    "fixture list delete placement",
)
write(fixture_path, fixture)


# Add interaction and deterministic desktop/mobile confirmation evidence.
test_path = "e2e/creative-production.spec.ts"
tests = read(test_path)
marker = '''test("desktop navigation can collapse to an icon rail and remembers the choice", async ({
'''
additions = dedent(
    '''
    test("Creative Job deletion uses an app-owned confirmation at list and detail placements", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1180, height: 900 });
      await openFixture(page);
      await expect(page.getByTestId("creative-job-delete-button")).toBeVisible();
      await expect(page.getByTestId("creative-job-list-delete-button")).toBeVisible();

      await page.getByTestId("creative-job-list-delete-button").click();
      const dialog = page.getByTestId("creative-job-delete-confirmation");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", {
          name: "刪除「GOS KOL 脫毛廣告片」？",
        })
      ).toBeVisible();
      await expect(dialog).toContainText("系統 Audit 仍會保留操作記錄");
      await expect(dialog.getByRole("button", { name: "確認刪除" })).toBeVisible();
      await dialog.getByRole("button", { name: "取消" }).click();
      await expect(dialog).toBeHidden();
    });

    test("Creative Job delete confirmation desktop visual baseline", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await openFixture(page);
      await page.getByTestId("creative-job-list-delete-button").click();
      await expect(page.getByTestId("creative-job-delete-confirmation")).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await expect(page).toHaveScreenshot(
        "creative-job-delete-confirmation-desktop.png",
        { animations: "disabled", caret: "hide" }
      );
    });

    test("Creative Job delete confirmation mobile visual baseline", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openFixture(page);
      await page.getByTestId("creative-job-list-delete-button").click();
      await expect(page.getByTestId("creative-job-delete-confirmation")).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await expect(page).toHaveScreenshot(
        "creative-job-delete-confirmation-mobile.png",
        { animations: "disabled", caret: "hide" }
      );
    });

    test("desktop navigation can collapse to an icon rail and remembers the choice", async ({
    '''
)
tests = replace_once(tests, marker, additions, "Creative delete visual tests")
write(test_path, tests)


# Replace the initial source-only delete checks with the new reusable control contract.
creative_contract_path = "scripts/verify-creative-production-contract.mjs"
creative_contract = read(creative_contract_path)
creative_contract = replace_once(
    creative_contract,
    'const listPage = read("src/app/creative-jobs/page.tsx");\n',
    'const listPage = read("src/app/creative-jobs/page.tsx");\nconst deleteControl = read("src/components/creative/CreativeJobDeleteControl.tsx");\n',
    "Creative delete control contract source",
)
creative_contract = replace_once(
    creative_contract,
    '''assert.match(listPage, /deleteCreativeJobAction/);
assert.match(listPage, /creative-job-list-delete-button/);
assert.match(studio, /creative-job-delete-button/);
assert.match(studio, /刪除 Job/);
assert.match(actions, /設計工作已從 Job List 刪除/);''',
    '''assert.match(listPage, /CreativeJobDeleteControl/);
assert.match(listPage, /listReturnPath/);
assert.match(listPage, /returnPath=\{listReturnPath\}/);
assert.match(deleteControl, /SystemConfirmationDialog/);
assert.match(deleteControl, /deleteCreativeJobAction/);
assert.match(deleteControl, /creative-job-list-delete-button/);
assert.match(deleteControl, /creative-job-delete-button/);
assert.match(studio, /CreativeJobDeleteControl/);
assert.match(actions, /readString\(formData, "returnPath"\)/);
assert.match(actions, /redirectWithMessage\(\s*returnPath/);
assert.match(actions, /設計工作已從 Job List 刪除/);''',
    "Creative delete and return path contract",
)
write(creative_contract_path, creative_contract)


# Require Storybook, visual evidence, ADR and rollback records at build time.
design_contract_path = "scripts/verify-design-system-contract.mjs"
design_contract = read(design_contract_path)
design_contract = replace_once(
    design_contract,
    '  "src/components/system/SystemButton.tsx",\n',
    '  "src/components/system/SystemButton.tsx",\n  "src/components/system/SystemConfirmationDialog.tsx",\n  "src/components/system/SystemConfirmationDialog.stories.tsx",\n',
    "System confirmation required files",
)
design_contract = replace_once(
    design_contract,
    '  "docs/design-system/decisions/ADR-001-design-quality-foundation.md",\n  "docs/design-system/rollback/2026-08-31-foundation-v1.md",\n',
    '  "docs/design-system/decisions/ADR-001-design-quality-foundation.md",\n  "docs/design-system/decisions/ADR-002-system-confirmation-dialog.md",\n  "docs/design-system/rollback/2026-08-31-foundation-v1.md",\n  "docs/design-system/rollback/2026-09-01-creative-job-delete-confirmation.md",\n  "e2e/creative-production.spec.ts-snapshots/creative-job-delete-confirmation-desktop-chromium-linux.png",\n  "e2e/creative-production.spec.ts-snapshots/creative-job-delete-confirmation-mobile-chromium-linux.png",\n',
    "confirmation evidence required files",
)
design_contract = replace_once(
    design_contract,
    '''assert.match(read("AGENTS.md"), /Design Quality Gate/);
assert.match(read("docs/design-system/CHANGELOG.md"), /Foundation v1/);''',
    '''const confirmationDialog = read(
  "src/components/system/SystemConfirmationDialog.tsx"
);
const confirmationStory = read(
  "src/components/system/SystemConfirmationDialog.stories.tsx"
);
const creativeVisualTest = read("e2e/creative-production.spec.ts");
assert.match(confirmationDialog, /@base-ui\/react\/dialog/);
assert.match(confirmationDialog, /buttonVariants/);
assert.match(confirmationDialog, /Dialog\.Description/);
assert.match(confirmationStory, /OpenDanger/);
assert.match(confirmationStory, /IconTrigger/);
assert.match(
  creativeVisualTest,
  /creative-job-delete-confirmation-desktop\.png/
);
assert.match(
  creativeVisualTest,
  /creative-job-delete-confirmation-mobile\.png/
);
assert.match(read("AGENTS.md"), /Design Quality Gate/);
assert.match(read("docs/design-system/CHANGELOG.md"), /Foundation v1/);
assert.match(
  read("docs/design-system/CHANGELOG.md"),
  /Creative Job deletion confirmation/
);''',
    "confirmation design contract assertions",
)
write(design_contract_path, design_contract)


# Record the design change and evidence.
changelog_path = "docs/design-system/CHANGELOG.md"
changelog = read(changelog_path)
changelog = replace_once(
    changelog,
    "# Design System Change Log\n\n",
    dedent(
        '''
        # Design System Change Log

        ## 2026-09-01 — Creative Job deletion confirmation

        Issue: #79

        ### Added

        - `SystemConfirmationDialog`, an app-owned Base UI confirmation pattern for destructive actions.
        - Storybook states for closed, icon-trigger and open destructive confirmation.
        - Desktop and mobile Playwright screenshot baselines for the Creative Job delete confirmation.
        - A feature-level `CreativeJobDeleteControl` shared by Job List and Job detail placements.
        - A validated `returnPath` contract so deletion preserves the active list filters.

        ### Safety

        - Delete remains permission-gated and uses soft deletion; Audit evidence is retained.
        - Browser-native `window.confirm` is not used for this workflow.
        - No database schema, Lead, CRM, Calendar, Spend or reporting calculation is changed.

        ### Evidence and rollback

        - Storybook: `System/Overlays/SystemConfirmationDialog`.
        - Visual baselines: `creative-job-delete-confirmation-desktop` and `creative-job-delete-confirmation-mobile`.
        - Decision: `ADR-002-system-confirmation-dialog.md`.
        - Rollback: `2026-09-01-creative-job-delete-confirmation.md`.

        '''
    ),
    "Design changelog entry",
)
write(changelog_path, changelog)

print("Creative Job deletion review feedback has been fully remediated.")
